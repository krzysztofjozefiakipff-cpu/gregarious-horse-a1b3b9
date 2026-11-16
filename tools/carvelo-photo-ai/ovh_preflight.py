"""Read-only infrastructure gate. Never claims jobs or prints connection details."""
import json
import os
import sys

def main():
    report = {'database': 'not_checked', 'storage': 'not_checked'}
    try:
        import psycopg
        with psycopg.connect(os.environ['CARVELO_DATABASE_URL'], connect_timeout=10,
                              options='-c default_transaction_read_only=on') as conn:
            with conn.cursor() as cur:
                cur.execute("""SELECT to_regprocedure('public.cv_ai_claim(text)') IS NOT NULL,
                    to_regprocedure('public.cv_ai_complete_v3(uuid,text,text,boolean,numeric,text,text)') IS NOT NULL,
                    to_regprocedure('public.cv_ai_fail(uuid,text,text)') IS NOT NULL,
                    to_regclass('public.cv_photo_jobs') IS NOT NULL""")
                report['database'] = 'compatible' if all(cur.fetchone()) else 'queue_contract_missing'
    except Exception:
        report['database'] = 'connection_or_configuration_failed'
    try:
        from ovh_storage import OVHStorage
        storage = OVHStorage()
        for bucket in (storage.originals, storage.results):
            storage.client.head_bucket(Bucket=bucket)
            config = storage.client.get_public_access_block(Bucket=bucket)['PublicAccessBlockConfiguration']
            if not all(config.get(k, False) for k in ('BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets')):
                raise ValueError('private_storage_required')
        report['storage'] = 'private_buckets_reachable'
    except Exception:
        report['storage'] = 'access_or_privacy_not_verified'
    print(json.dumps(report, sort_keys=True))
    return 0 if report == {'database': 'compatible', 'storage': 'private_buckets_reachable'} else 1

if __name__ == '__main__':
    sys.exit(main())
