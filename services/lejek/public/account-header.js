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
let foxAssistantRole=null;

foxAssistantOpen.onclick=()=>foxAssistant.showModal();

function appendFoxMessage(speaker,message) {
  const row=document.createElement('p');
  row.dataset.speaker=speaker;
  const label=document.createElement('strong');
  label.textContent=speaker;
  row.append(label,'\n'+message);
  foxAssistantMessages.append(row);
  foxAssistantMessages.scrollTop=foxAssistantMessages.scrollHeight;
}

foxAssistantForm.onsubmit=async event=>{
  event.preventDefault();
  const question=foxAssistantQuestion.value.trim();
  const send=foxAssistantForm.querySelector('button');
  if (!question||!foxAssistantRole||send.disabled) return;
  send.disabled=true;
  foxAssistantStatus.hidden=false;
  foxAssistantStatus.textContent='Lisek przygotowuje odpowiedź…';
  try {
    const response=await fetch('/api/assistant?'+new URLSearchParams({role:foxAssistantRole}),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({feature:'fox',question})
    });
    const result=await response.json();
    if (!response.ok||typeof result.text!=='string') throw new Error(result.error);
    appendFoxMessage('Ty',question);
    appendFoxMessage('Lisek',result.text);
    if (foxAssistantQuestion.value.trim()===question) foxAssistantQuestion.value='';
    foxAssistantStatus.hidden=true;
  } catch (error) {
    foxAssistantStatus.textContent=error.message||'Nie udało się pobrać odpowiedzi. Spróbuj ponownie.';
  } finally {
    send.disabled=false;
  }
};
