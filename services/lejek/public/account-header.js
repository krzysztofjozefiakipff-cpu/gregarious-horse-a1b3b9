const accountRoleNames={admin:'Administrator',group:'Szef grupy',manager:'Kierownik',seller:'Handlowiec',staff:'Pracownik'};
const headerRolePicker=document.getElementById('account-role');

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
  headerRolePicker.hidden=roles.length<2;
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
const FoxRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const foxSpeech=window.speechSynthesis;
const foxCanSpeak=Boolean(foxSpeech&&window.SpeechSynthesisUtterance);
let foxAssistantRole=null;
let foxRecognition=null;
let foxSpeaking=null;
let foxSendByVoice=false;

foxAssistantMic.hidden=!FoxRecognition;

function foxStatus(message) {
  foxAssistantStatus.textContent=message;
  foxAssistantStatus.hidden=!message;
}

function stopFoxSpeech() {
  if (!foxSpeaking) return;
  foxSpeaking.button.textContent='Odsłuchaj odpowiedź';
  foxSpeaking=null;
  foxSpeech.cancel();
}

function speakFoxAnswer(message,button) {
  const wasSpeaking=foxSpeaking?.button===button;
  stopFoxSpeech();
  if (wasSpeaking) return;
  const speech=new SpeechSynthesisUtterance(message);
  speech.lang='pl-PL';
  const voice=foxSpeech.getVoices().find(item=>/^pl(?:-|$)/i.test(item.lang));
  if (voice) speech.voice=voice;
  foxSpeaking={speech,button};
  button.textContent='Zatrzymaj odczyt';
  const finish=(error=false)=>{
    if (foxSpeaking?.speech!==speech) return;
    foxSpeaking=null;
    button.textContent='Odsłuchaj odpowiedź';
    if (error) foxStatus('Nie udało się odtworzyć odpowiedzi. Spróbuj użyć przycisku odsłuchu.');
  };
  speech.onend=()=>finish();
  speech.onerror=()=>finish(true);
  foxSpeech.speak(speech);
}

function stopFoxRecording() {
  if (!foxRecognition) return;
  const recognition=foxRecognition;
  foxRecognition=null;
  foxAssistantMic.textContent='🎙️ Zadaj głosowo';
  recognition.abort();
}

foxAssistantMic.onclick=()=>{
  if (!FoxRecognition||foxAssistantForm.querySelector('button[type="submit"]').disabled) return;
  if (foxRecognition) {
    stopFoxRecording();
    foxStatus('');
    return;
  }
  stopFoxSpeech();
  const recognition=new FoxRecognition();
  recognition.lang='pl-PL';
  recognition.interimResults=false;
  recognition.continuous=false;
  foxRecognition=recognition;
  foxAssistantMic.textContent='Anuluj nagrywanie';
  foxStatus('Słucham. Zadaj pytanie po polsku.');
  recognition.onresult=event=>{
    if (foxRecognition!==recognition||!foxAssistant.open) return;
    const question=event.results[event.resultIndex]?.[0]?.transcript?.trim();
    if (!question) return;
    foxAssistantQuestion.value=question.slice(0,foxAssistantQuestion.maxLength);
    foxSendByVoice=true;
    foxAssistantForm.requestSubmit();
  };
  recognition.onerror=event=>{
    if (foxRecognition!==recognition) return;
    foxStatus(['not-allowed','service-not-allowed'].includes(event.error)
      ?'Zezwól przeglądarce na dostęp do mikrofonu albo wpisz pytanie.'
      :'Nie udało się rozpoznać pytania. Spróbuj ponownie albo wpisz je ręcznie.');
  };
  recognition.onend=()=>{
    if (foxRecognition!==recognition) return;
    foxRecognition=null;
    foxAssistantMic.textContent='🎙️ Zadaj głosowo';
    if (foxAssistantStatus.textContent==='Słucham. Zadaj pytanie po polsku.') foxStatus('');
  };
  try {recognition.start();}
  catch {
    recognition.onend();
    foxStatus('Mikrofon jest niedostępny. Możesz wpisać pytanie lub użyć dyktowania z klawiatury.');
  }
};

foxAssistant.addEventListener('close',()=>{
  stopFoxSpeech();
  if (foxRecognition) {
    stopFoxRecording();
    foxStatus('');
  }
});

foxAssistantOpen.onclick=()=>foxAssistant.showModal();

function appendFoxMessage(speaker,message) {
  const row=document.createElement('p');
  row.dataset.speaker=speaker;
  const label=document.createElement('strong');
  label.textContent=speaker;
  row.append(label,'\n'+message);
  foxAssistantMessages.append(row);
  let listen;
  if (speaker==='Lisek'&&foxCanSpeak) {
    listen=document.createElement('button');
    listen.type='button';
    listen.textContent='Odsłuchaj odpowiedź';
    listen.onclick=()=>speakFoxAnswer(message,listen);
    row.append(listen);
  }
  foxAssistantMessages.scrollTop=foxAssistantMessages.scrollHeight;
  return listen;
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
  foxStatus('Lisek przygotowuje odpowiedź…');
  try {
    const response=await fetch('/api/assistant?'+new URLSearchParams({role:foxAssistantRole}),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({feature:'fox',question})
    });
    const result=await response.json();
    if (!response.ok||typeof result.text!=='string') throw new Error(result.error);
    appendFoxMessage('Ty',question);
    const listen=appendFoxMessage('Lisek',result.text);
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
