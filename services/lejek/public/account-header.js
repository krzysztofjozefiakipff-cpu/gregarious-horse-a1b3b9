const accountRoleNames={admin:'Administrator',group:'Szef grupy',manager:'Kierownik',seller:'Handlowiec',staff:'Pracownik'};
const headerRolePicker=document.getElementById('account-role');
const accountMenu=document.getElementById('account-menu');
document.addEventListener('click',event=>{
  if (accountMenu.open&&!accountMenu.contains(event.target)) accountMenu.open=false;
});
accountMenu.addEventListener('keydown',event=>{
  if (event.key!=='Escape'||!accountMenu.open) return;
  accountMenu.open=false;
  accountMenu.querySelector('summary').focus();
});

function renderAccountHeader({role,roles,accountHeader},preview=null) {
  const {firstName,brand}=accountHeader??{};
  const logo=document.getElementById('account-dealer-logo');
  logo.hidden=!brand?.logo;
  if (brand?.logo) {
    if (logo.getAttribute('src')!==brand.logo) logo.src=brand.logo;
    logo.alt=brand.name||'Logo dealera';
  } else logo.removeAttribute('src');
  document.getElementById('account-greeting').textContent=firstName?'Cześć, '+firstName+'!':'Cześć!';
  if (roles.length!==headerRolePicker.options.length||roles.some((value,index)=>headerRolePicker.options[index].value!==value)) {
    headerRolePicker.replaceChildren(...roles.map(value=>new Option(accountRoleNames[value],value)));
  }
  document.getElementById('account-role-field').hidden=roles.length<2;
  const currentRole=document.getElementById('account-current-role');
  currentRole.hidden=roles.length>1;
  currentRole.textContent=accountRoleNames[role]??'';
  headerRolePicker.value=role;
  headerRolePicker.onchange=()=>{
    const next=headerRolePicker.value;
    const params=new URLSearchParams({role:next});
    if (preview) params.set('podglad',preview);
    else sessionStorage.setItem('lejek-active-role',next);
    location.assign((next==='staff'?'/z-zycia-salonu.html':'/daily.html')+'?'+params);
  };
  const controls=document.getElementById('account-controls');
  controls.querySelector('.panel-signout').hidden=Boolean(preview);
  controls.hidden=false;
  foxAssistantOpen.hidden=Boolean(preview);
  foxAssistantRole=preview?null:role;
}

const foxAssistantOpen=document.getElementById('fox-assistant-open');
const foxAssistant=document.getElementById('fox-assistant');
const foxAssistantForm=document.getElementById('fox-assistant-form');
const foxAssistantQuestion=document.getElementById('fox-assistant-question');
const foxAssistantMessages=document.getElementById('fox-assistant-messages');
const foxAssistantStatus=document.getElementById('fox-assistant-status');
const foxAssistantMic=document.getElementById('fox-assistant-mic');


let foxAssistantRole=null;
let foxRecording=null;
let foxSpeaking=null;
let foxSendByVoice=false;


function foxStatus(message,activity='') {
  foxAssistant.dataset.activity=activity;
  foxAssistantStatus.textContent=message;
  foxAssistantStatus.hidden=!message;
}

function stopFoxSpeech() {
  const current=foxSpeaking;
  if (!current) return;
  foxSpeaking=null;
  current.controller.abort();
  current.audio.pause();
  current.audio.removeAttribute('src');
  if (current.url) URL.revokeObjectURL(current.url);
  current.button.textContent='Odsłuchaj odpowiedź';
}

async function playFoxAudio(current) {
  current.ready=false;
  current.button.textContent='Zatrzymaj odczyt';
  try {
    await current.audio.play();
  } catch(error) {
    if (foxSpeaking!==current) return;
    if (error.name==='NotAllowedError') {
      current.ready=true;
      current.button.textContent='Odtwórz odpowiedź';
      return;
    }
    stopFoxSpeech();
    foxStatus('Nie udało się odtworzyć odpowiedzi. Spróbuj ponownie.');
  }
}

async function speakFoxAnswer(message,button) {
  if (foxRecording) {
    stopFoxRecording();
    foxStatus('');
  }
  if (foxSpeaking?.button===button) {
    if (foxSpeaking.ready) return playFoxAudio(foxSpeaking);
    stopFoxSpeech();
    return;
  }
  stopFoxSpeech();
  const current={audio:new Audio(),button,controller:new AbortController(),url:null,ready:false};
  foxSpeaking=current;
  button.textContent='Anuluj przygotowanie głosu';
  try {
    const response=await fetch('/api/assistant?'+new URLSearchParams({role:foxAssistantRole}),{
      method:'POST',headers:{'Content-Type':'application/json'},signal:current.controller.signal,
      body:JSON.stringify({feature:'speak',text:message})
    });
    if (!response.ok) throw new Error((await response.json()).error);
    const audio=await response.blob();
    if (foxSpeaking!==current) return;
    current.url=URL.createObjectURL(audio);
    current.audio.onended=()=>{if (foxSpeaking===current) stopFoxSpeech();};
    current.audio.src=current.url;
    await playFoxAudio(current);
  } catch(error) {
    if (foxSpeaking!==current) return;
    stopFoxSpeech();
    foxStatus(error.message||'Nie udało się przygotować głosu Liska. Spróbuj ponownie.');
  }
}

function releaseFoxRecording(recording) {
  clearTimeout(recording.timer);
  clearInterval(recording.speechTimer);
  if (recording.context && recording.context.state!=='closed') void recording.context.close().catch(()=>{});
  recording.stream?.getTracks().forEach(track=>track.stop());
}

function stopFoxRecording() {
  const recording=foxRecording;
  if (!recording) return;
  foxRecording=null;
  releaseFoxRecording(recording);
  recording.upload?.abort();
  foxAssistantMic.textContent='🎙️ Zadaj głosowo';
}

async function sendFoxRecording(recording,blob) {
  releaseFoxRecording(recording);
  if (foxRecording!==recording||!foxAssistant.open) return;
  foxAssistantMic.textContent='Anuluj';
  foxStatus('Rozpoznaję pytanie…','thinking');
  const upload=new AbortController();
  recording.upload=upload;
  try {
    if (!blob.size||blob.size>1_050_000) throw new Error('Powtórz pytanie. Nagranie było puste lub za długie.');
    const audio=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(new Error('Nie udało się odczytać nagrania.'));
      reader.readAsDataURL(blob);
    });
    const response=await fetch('/api/assistant?'+new URLSearchParams({role:foxAssistantRole}),{
      method:'POST',headers:{'Content-Type':'application/json'},signal:upload.signal,
      body:JSON.stringify({feature:'transcribe',mime:blob.type.split(';')[0],audio})
    });
    const result=await response.json();
    if (!response.ok||typeof result.text!=='string') throw new Error(result.error);
    if (foxRecording!==recording||!foxAssistant.open) return;
    stopFoxRecording();
    foxAssistantQuestion.value=result.text;
    foxSendByVoice=true;
    foxAssistantForm.requestSubmit();
  } catch (error) {
    if (foxRecording!==recording) return;
    stopFoxRecording();
    foxStatus(error.message||'Nie udało się rozpoznać pytania. Spróbuj ponownie.');
  }
}

function watchFoxSpeech(recording) {
  const analyser=recording.context.createAnalyser();
  analyser.fftSize=1024;
  recording.context.createMediaStreamSource(recording.stream).connect(analyser);
  const samples=new Float32Array(analyser.fftSize);
  let noiseFloor=.006;
  let activeSince=null;
  let lastSound=0;
  recording.speechTimer=setInterval(()=>{
    analyser.getFloatTimeDomainData(samples);
    let power=0;
    for (const sample of samples) power+=sample*sample;
    const level=Math.sqrt(power/samples.length);
    const now=performance.now();
    if (level>Math.max(.014,noiseFloor*2.6)) {
      activeSince??=now;
      lastSound=now;
      if (!recording.heardSpeech&&now-activeSince>=120) {
        recording.heardSpeech=true;
        foxAssistantMic.textContent='Zakończ i wyślij';
        foxStatus('Słucham… Wyślę pytanie po chwili ciszy.','listening');
      }
    } else {
      activeSince=null;
      if (!recording.heardSpeech) noiseFloor=noiseFloor*.94+level*.06;
    }
    if (recording.heardSpeech&&now-lastSound>=1250&&recording.recorder.state==='recording') recording.recorder.stop();
  },40);
}

async function startFoxRecording(automatic=false) {
  if (foxRecording||!foxAssistantRole||foxAssistantForm.querySelector('button[type="submit"]').disabled) return;
  if (!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder) {
    foxStatus('Ten widok nie udostępnia mikrofonu. Otwórz biegwyzej.pl bezpośrednio w Safari lub użyj dyktowania na klawiaturze.');
    return;
  }
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if (automatic&&!AudioContextClass) return;
  stopFoxSpeech();
  const recording={automatic};
  foxRecording=recording;
  foxAssistantMic.textContent='Anuluj';
  foxStatus('Oczekuję na dostęp do mikrofonu…');
  try {
    if (automatic) {
      recording.context=new AudioContextClass();
      void recording.context.resume().catch(()=>{});
    }
    recording.stream=await navigator.mediaDevices.getUserMedia({audio:true});
    if (foxRecording!==recording||!foxAssistant.open) {
      releaseFoxRecording(recording);
      return;
    }
    const mimeType=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type));
    const recorder=new MediaRecorder(recording.stream,mimeType?{mimeType}:{});
    recording.recorder=recorder;
    const chunks=[];
    recorder.ondataavailable=event=>{if (event.data.size) chunks.push(event.data);};
    recorder.onstop=()=>void sendFoxRecording(recording,new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type}));
    recorder.onerror=()=>{
      if (foxRecording!==recording) return;
      stopFoxRecording();
      foxStatus('Nagrywanie zostało przerwane. Spróbuj ponownie.');
    };
    recorder.start();
    if (automatic) {
      watchFoxSpeech(recording);
      foxStatus('Powiedz pytanie albo zacznij pisać.','listening');
    } else {
      foxAssistantMic.textContent='Zakończ i wyślij';
      foxStatus('Słucham. Po zadaniu pytania wybierz „Zakończ i wyślij”.','listening');
    }
    recording.timer=setTimeout(()=>{
      if (foxRecording!==recording||recorder.state!=='recording') return;
      if (automatic&&!recording.heardSpeech) {
        stopFoxRecording();
        foxStatus('Możesz wpisać pytanie lub ponownie włączyć mikrofon.');
      } else {
        recorder.stop();
      }
    },20000);
  } catch (error) {
    if (foxRecording!==recording) return;
    stopFoxRecording();
    foxStatus(error.name==='NotAllowedError'
      ?'Dostęp do mikrofonu jest zablokowany. Na iPhonie otwórz stronę w Safari i w ustawieniach witryny zezwól na mikrofon.'
      :'Mikrofon jest niedostępny. Możesz użyć dyktowania na klawiaturze.');
  }
}

foxAssistantMic.onclick=()=>{
  if (foxRecording?.recorder?.state==='recording'&&(!foxRecording.automatic||foxRecording.heardSpeech)) {
    foxRecording.recorder.stop();
    return;
  }
  if (foxRecording) {
    stopFoxRecording();
    foxStatus('');
    return;
  }
  void startFoxRecording();
};

foxAssistantQuestion.addEventListener('input',()=>{
  if (!foxRecording) return;
  stopFoxRecording();
  foxStatus('');
});

document.addEventListener('visibilitychange',()=>{
  if (document.visibilityState==='hidden'&&foxRecording) {
    stopFoxRecording();
    foxStatus('');
  }
});

foxAssistant.addEventListener('close',()=>{
  stopFoxSpeech();
  if (foxRecording) {
    stopFoxRecording();
    foxStatus('');
  }
});

foxAssistantOpen.onclick=()=>{
  foxAssistant.showModal();
  if (window.matchMedia('(pointer: fine)').matches) foxAssistantQuestion.focus();
  if (!foxAssistantQuestion.value) void startFoxRecording(true);
};

function appendFoxMessage(speaker,message,citations=[]) {
  const row=document.createElement('p');
  row.dataset.speaker=speaker;
  const label=document.createElement('strong');
  label.textContent=speaker;
  row.append(label,'\n');
  let offset=0;
  for (const citation of [...citations].sort((a,b)=>a.at-b.at)) {
    const url=new URL(citation.url);
    if (!['http:','https:'].includes(url.protocol)||citation.at<offset||citation.at>message.length) continue;
    const link=document.createElement('a');
    link.href=url.href;
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.textContent=' ['+citation.title+']';
    row.append(message.slice(offset,citation.at),link);
    offset=citation.at;
  }
  row.append(message.slice(offset));
  foxAssistantMessages.append(row);
  let listen;
  if (speaker!=='Ty'&&foxAssistantRole&&message.length<=4000) {
    listen=document.createElement('button');
    listen.type='button';
    listen.textContent='Odsłuchaj odpowiedź';
    listen.onclick=()=>speakFoxAnswer(message,listen);
    row.append(listen);
  }
  foxAssistantMessages.scrollTop=foxAssistantMessages.scrollHeight;
  return listen;
}

function offerFoxSave(proposal,byVoice) {
  const controls=document.createElement('div');
  const save=document.createElement('button');
  const cancel=document.createElement('button');
  save.type=cancel.type='button';
  save.textContent='Potwierdź zapis';
  cancel.textContent='Anuluj';
  cancel.onclick=()=>controls.remove();
  save.onclick=async()=>{
    if (proposal.type==='activity'&&document.querySelector('#entry-draft-state[data-unsaved="true"]')) {
      foxStatus('Zapisz najpierw zmiany w zakładce Wpisz działania i ponów polecenie.');
      return;
    }
    save.disabled=cancel.disabled=true;
    foxStatus('Zapisuję zmianę…','thinking');
    try {
      const response=await fetch('/api/assistant?'+new URLSearchParams({role:foxAssistantRole}),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({feature:'fox-save',proposal})
      });
      const result=await response.json();
      if (!response.ok||typeof result.text!=='string') throw new Error(result.error);
      controls.remove();
      const listen=appendFoxMessage('Lisek',result.text);
      foxStatus('');
      if (byVoice&&listen&&foxAssistant.open) speakFoxAnswer(result.text,listen);
      window.dispatchEvent(new Event('fox-saved'));
    } catch(error) {
      controls.remove();
      appendFoxMessage('Lisek',error.message||'Nie udało się potwierdzić zapisu. Sprawdź wpis przed ponowieniem polecenia.');
      foxStatus('');
    }
  };
  controls.append(save,cancel);
  foxAssistantMessages.append(controls);
  foxAssistantMessages.scrollTop=foxAssistantMessages.scrollHeight;
}

foxAssistantForm.onsubmit=async event=>{
  event.preventDefault();
  const question=foxAssistantQuestion.value.trim();
  const send=foxAssistantForm.querySelector('button[type="submit"]');
  const byVoice=foxSendByVoice;
  foxSendByVoice=false;
  if (!question||!foxAssistantRole||send.disabled) return;
  stopFoxRecording();
  send.disabled=true;
  foxAssistantMic.disabled=true;
  foxStatus('Lisek przygotowuje odpowiedź…','thinking');
  try {
    const response=await fetch('/api/assistant?'+new URLSearchParams({role:foxAssistantRole}),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({feature:'fox',question})
    });
    const result=await response.json();
    if (!response.ok||typeof result.text!=='string') throw new Error(result.error);
    appendFoxMessage('Ty',question);
    const listen=appendFoxMessage(result.source==='web'?'Lisek · Internet':'Lisek',result.text,result.citations);
    if (result.proposal) offerFoxSave(result.proposal,byVoice);
    if (foxAssistantQuestion.value.trim()===question) foxAssistantQuestion.value='';
    foxStatus('');
    if (byVoice&&listen&&foxAssistant.open) speakFoxAnswer(result.text,listen);
  } catch (error) {
    foxStatus(error.message||'Nie udało się pobrać odpowiedzi. Spróbuj ponownie.');
  } finally {
    send.disabled=false;
    foxAssistantMic.disabled=false;
  }
};
