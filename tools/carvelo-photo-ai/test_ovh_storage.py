import io
import os
import unittest
from unittest.mock import Mock, patch
from ovh_storage import OVHStorage, MAX_BYTES

ENV = {'CARVAMO_S3_ENDPOINT': 'https://s3.example.test', 'CARVAMO_S3_REGION': 'test',
       'CARVAMO_S3_ORIGINALS_BUCKET': 'originals', 'CARVAMO_S3_RESULTS_BUCKET': 'results'}

class StorageTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, ENV)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = Mock()
        self.storage = OVHStorage(self.client)

    def test_bounded_download_and_close(self):
        body = io.BytesIO(b'a' * (MAX_BYTES + 1))
        self.client.get_object.return_value = {'Body': body}
        with self.assertRaisesRegex(ValueError, 'source_size_limit'):
            self.storage.download('offer/photo.jpg')
        self.assertTrue(body.closed)

    def test_private_conditional_write(self):
        self.storage.upload('offer/ai/result.png', b'image')
        self.client.put_object.assert_called_once_with(Bucket='results', Key='offer/ai/result.png',
            Body=b'image', ContentType='image/png', IfNoneMatch='*')

    def test_bad_keys_never_reach_storage(self):
        for key in ('../x', '/x', 'a//b', 'a/./b', 'a\\b', ''):
            with self.assertRaises(ValueError):
                self.storage.download(key)
        self.client.get_object.assert_not_called()

    def test_insecure_endpoint_rejected(self):
        with patch.dict(os.environ, {'CARVAMO_S3_ENDPOINT': 'http://s3.example.test'}):
            with self.assertRaises(ValueError):
                OVHStorage(self.client)

    def test_download(self):
        body = io.BytesIO(b'image')
        self.client.get_object.return_value = {'Body': body, 'ContentLength': 5}
        self.assertEqual(self.storage.download('offer/photo.jpg'), b'image')
        self.assertTrue(body.closed)

if __name__ == '__main__':
    unittest.main()
