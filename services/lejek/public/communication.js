const communicationNode=id=>document.getElementById('communication-'+id);
const communicationDialog=communicationNode('dialog');
const communicationButton=communicationNode('open');
const communicationStatus=communicationNode('status');
const communicationSend=communicationNode('send');
const communicationPosition=communicationNode('position');
const communicationReply=communicationNode('reply');
const communicationOlder=communicationNode('older');
let communicationRole;
let communicationThread;
let communicationRevision=0;
let communicationBefore;
let communicationStaff=[];

async function communicationRequest(query={},body) {
  const params=new URLSearchParams({...query,role:communicationRole});
  const response=await fetch('/api/communication?'+params,body&&{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const result=await response.json();
  if (!response.ok) throw new Error(result.error||'Nie udało się pobrać wiadomości.');
  return result;
}

async function updateCommunicationCount() {
  if (!communicationRole||document.hidden) return;
  const role=communicationRole;
  try {
    const {unread}=await communicationRequest({count:'1'});
    if (role!==communicationRole) return;
    const badge=communicationNode('count');
    badge.hidden=!unread;
    badge.textContent=unread>99?'99+':unread;
    communicationButton.setAttribute('aria-label',unread?'Wiadomości i powiadomienia, nieprzeczytane: '+unread:'Wiadomości i powiadomienia');
  } catch { /* A background refresh must not interrupt the current screen. */ }
}

function setCommunicationRole(role) {
  communicationButton.hidden=!role;
  if (communicationRole===role) return;
  communicationRole=role;
  communicationRevision++;
  if (communicationDialog.open) communicationDialog.close();
  void updateCommunicationCount();
}

function loadCommunicationPosition() {
  const {person,position}=communicationPosition.elements;
  position.value=communicationStaff.find(member=>member.id===Number(person.value))?.position??'';
}

async function showCommunicationInbox() {
  const revision=++communicationRevision;
  communicationThread=null;
  communicationNode('thread').hidden=true;
  communicationNode('inbox').hidden=false;
  communicationStatus.textContent='Wczytuję skrzynkę…';
  try {
    const data=await communicationRequest();
    if (revision!==communicationRevision||!communicationDialog.open) return;
    const list=communicationNode('list');
    list.replaceChildren(...data.inbox.map(item=>{
      const row=document.createElement('li');
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary';
      button.textContent=item.title+(item.unread?' · Nowe: '+item.unread:'');
      button.onclick=()=>void showCommunicationThread(item.id);
      row.append(button);
      return row;
    }));
    communicationNode('events').hidden=!data.events.length;
    communicationNode('event-list').replaceChildren(...data.events.map(event=>{
      const row=document.createElement('li');
      const link=document.createElement('button');
      link.type='button';
      link.className='secondary';
      const labels={calendar_approved:'Zatwierdzono zgłoszenie w kalendarzu',calendar_rejected:'Odrzucono zgłoszenie w kalendarzu',plan_approved:'Zatwierdzono plan'};
      link.textContent=(event.unread?'Nowe · ':'')+labels[event.kind]+' · '+event.subject;
      link.onclick=async()=>{
        try {
          await communicationRequest({},{action:'event-read',id:event.id});
          const route=event.kind==='plan_approved'?'plan':'kalendarz-pracy';
          location.assign('/daily.html?role=seller#'+route);
        } catch(error) {communicationStatus.textContent=error.message;}
      };
      row.append(link);
      return row;
    }));
    const destinations=communicationSend.elements.destination;
    const selected=destinations.value;
    const options=[...data.contacts.map(person=>new Option(person.name+' · '+(person.salon||person.groupName||''),JSON.stringify({kind:'direct',recipient:person.contact}))),
      ...data.groups.flatMap(group=>Object.entries(data.departments).map(([department,label])=>
        new Option(label+' · '+group,JSON.stringify({kind:'department',department,group})))),
      ...data.announcements.map(({scope,name})=>new Option('Ogłoszenie · '+name,JSON.stringify({kind:'announcement',scope,audience:name})))];
    destinations.replaceChildren(new Option('Wybierz odbiorcę',''),...options);
    if (options.some(option=>option.value===selected)) destinations.value=selected;
    communicationNode('compose').hidden=!options.length;
    communicationStaff=data.staff;
    communicationNode('staff').hidden=!communicationStaff.length;
    const {person,position}=communicationPosition.elements;
    const previous=person.value;
    person.replaceChildren(new Option('Wybierz pracownika',''),...data.staff.map(member=>new Option(member.name+' · '+member.salon,member.id)));
    if (data.staff.some(member=>String(member.id)===previous)) person.value=previous;
    position.replaceChildren(new Option('Bez stanowiska',''),...Object.entries(data.positions).map(([id,label])=>new Option(label,id)));
    loadCommunicationPosition();
    communicationStatus.textContent=data.inbox.length?'':'Brak wiadomości.';
    void updateCommunicationCount();
  } catch(error) { if (revision===communicationRevision) communicationStatus.textContent=error.message; }
}

async function showCommunicationThread(id,before) {
  const revision=++communicationRevision;
  communicationStatus.textContent='Wczytuję wiadomości…';
  try {
    const data=await communicationRequest(before?{thread:id,before}:{thread:id});
    if (revision!==communicationRevision||!communicationDialog.open) return;
    communicationThread=id;
    communicationBefore=data.messages[0]?.id;
    communicationOlder.hidden=!data.hasOlder;
    communicationNode('inbox').hidden=true;
    communicationNode('thread').hidden=false;
    communicationNode('subject').textContent=data.thread.title;
    communicationReply.hidden=data.thread.kind==='announcement';
    const messages=data.messages.map(message=>{
      const row=document.createElement('li');
      row.dataset.own=Boolean(message.own);
      const title=document.createElement('strong');
      title.textContent=message.own?'Ty':message.author;
      const text=document.createElement('p');
      text.textContent=message.message;
      row.append(title,text);
      return row;
    });
    const list=communicationNode('messages');
    if (before) list.prepend(...messages);
    else list.replaceChildren(...messages);
    communicationStatus.textContent='';
    if (!before&&data.messages.length) {
      await communicationRequest({},{action:'read',thread:id,last:data.messages.at(-1).id});
      void updateCommunicationCount();
    }
  } catch(error) { if (revision===communicationRevision) communicationStatus.textContent=error.message; }
}

async function submitCommunication(form,body,done) {
  const button=form.querySelector('button');
  button.disabled=true;
  communicationStatus.textContent='';
  try { await done(await communicationRequest({},body)); }
  catch(error) { communicationStatus.textContent=error.message; }
  finally {button.disabled=false;}
}

communicationButton.onclick=()=>{
  communicationDialog.showModal();
  void showCommunicationInbox();
};
communicationDialog.addEventListener('close',()=>{
  communicationRevision++;
  communicationReply.reset();
});
communicationNode('refresh').onclick=showCommunicationInbox;
communicationNode('back').onclick=showCommunicationInbox;
communicationOlder.onclick=()=>void showCommunicationThread(communicationThread,communicationBefore);
communicationSend.onsubmit=event=>{
  event.preventDefault();
  const {destination,title,message}=communicationSend.elements;
  if (!destination.value) return;
  void submitCommunication(communicationSend,{action:'send',...JSON.parse(destination.value),title:title.value,message:message.value},result=>{
    communicationSend.reset();
    return showCommunicationThread(result.thread);
  });
};
communicationReply.onsubmit=event=>{
  event.preventDefault();
  const thread=communicationThread;
  void submitCommunication(communicationReply,{action:'reply',thread,message:communicationReply.elements.message.value},()=>{
    communicationReply.reset();
    return showCommunicationThread(thread);
  });
};
communicationPosition.elements.person.onchange=loadCommunicationPosition;
communicationPosition.onsubmit=event=>{
  event.preventDefault();
  const {person,position}=communicationPosition.elements;
  void submitCommunication(communicationPosition,{action:'position',person:Number(person.value),position:position.value||null},async()=>{
    await showCommunicationInbox();
    communicationStatus.textContent='Zapisano stanowisko.';
  });
};
document.addEventListener('visibilitychange',updateCommunicationCount);
setInterval(updateCommunicationCount,20000);
