const communicationNode=id=>document.getElementById('communication-'+id);
const communicationDialog=communicationNode('dialog');
const communicationButton=communicationNode('open');
const communicationStatus=communicationNode('status');
const communicationSend=communicationNode('send');
const departmentDialog=document.getElementById('department-settings');
const departmentMenu=document.getElementById('department-menu-open');
const departmentAdmin=document.getElementById('department-admin-open');
const communicationReply=communicationNode('reply');
const communicationOlder=communicationNode('older');
let communicationRole;
let communicationThread;
let communicationRevision=0;
let communicationBefore;


async function communicationRequest(query={},body,path='/api/communication') {
  const params=new URLSearchParams({...query,role:communicationRole});
  const response=await fetch(path+'?'+params,body&&{
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
    const {unread,managesDepartment}=await communicationRequest({count:'1'});
    if (role!==communicationRole) return;
    departmentMenu.hidden=!managesDepartment;
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
  departmentMenu.hidden=true;
  if (departmentAdmin) departmentAdmin.hidden=role!=='group';
  communicationRevision++;
  if (communicationDialog.open) communicationDialog.close();
  void updateCommunicationCount();
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
      ...data.departments.map(({groupName,department,name,type,salon})=>
        new Option([name,salon??(type==='carwash'?'Bez przypisanego salonu':groupName)].join(' · '),JSON.stringify({kind:'department',department,group:groupName}))),
      ...data.announcements.map(({scope,name})=>new Option('Ogłoszenie · '+name,JSON.stringify({kind:'announcement',scope,audience:name})))];
    destinations.replaceChildren(new Option('Wybierz odbiorcę',''),...options);
    if (options.some(option=>option.value===selected)) destinations.value=selected;
    communicationNode('compose').hidden=!options.length;
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
async function loadDepartmentSettings(asHead) {
  const status=document.getElementById('department-settings-status');
  const forms=document.getElementById('department-settings-forms');
  try {
    const data=await communicationRequest();
    if (!departmentDialog.open) return;
    const departments=asHead?data.departments.filter(item=>item.groupName===data.departmentAdmin):data.ownDepartments;
    forms.replaceChildren(...departments.map(({groupName,department,name,manager,type,salon})=>{
      const section=document.createElement('section');
      const heading=document.createElement('h3');
      heading.textContent=type==='carwash'?name+' · '+(salon??'Bez przypisanego salonu'):name;
      section.append(heading);
      if (asHead&&type==='carwash'&&!salon) {
        const linkForm=document.createElement('form');
        const salonLabel=document.createElement('label');
        salonLabel.textContent='Salon myjni';
        const salonPicker=document.createElement('select');
        salonPicker.required=true;
        const available=data.departmentSalons.filter(item=>!departments.some(office=>office.salon===item));
        salonPicker.append(new Option(available.length?'Wybierz salon':'Brak salonów bez myjni',''),
          ...available.map(item=>new Option(item,item)));
        salonLabel.append(salonPicker);
        const link=document.createElement('button');
        link.textContent='Przypisz myjnię do salonu';
        link.disabled=!available.length;
        linkForm.append(salonLabel,link);
        linkForm.onsubmit=async event=>{
          event.preventDefault();
          link.disabled=true;
          try {
            await communicationRequest({},{action:'carwash-salon',group:groupName,department,salon:salonPicker.value});
            await loadDepartmentSettings(true);
            status.textContent='Przypisano myjnię do salonu.';
          } catch(error) {status.textContent=error.message;}
          finally {link.disabled=false;}
        };
        section.append(linkForm);
      }
      const form=document.createElement('form');
      const label=document.createElement('label');
      label.textContent=asHead?'Kierownik działu':'Istniejący użytkownik';
      const picker=document.createElement('select');
      picker.required=true;
      picker.append(new Option('Wybierz pracownika',''));
      for (const member of data.departmentPeople.filter(member=>member.groupName===groupName&&
        (!salon||!member.salon||member.salon===salon||member.id===manager||
          (!asHead&&data.memberships.some(item=>item.person===member.id&&item.groupName===groupName&&item.department===department))))) {
        const assigned=data.memberships.some(item=>item.person===member.id&&item.groupName===groupName&&item.department===department);
        const hints=[member.salon,assigned?'w dziale':''].filter(Boolean);
        picker.append(new Option([member.name,...hints].join(' · '),member.id));
      }
      if (manager&&asHead) picker.value=manager;
      label.append(picker);
      const save=document.createElement('button');
      save.textContent=asHead?'Przypisz kierownika':'Nadaj rolę pracownika działu';
      form.append(label,save);
      section.append(form);
      if (!asHead) {
        const remove=document.createElement('button');
        remove.value='remove';
        remove.className='secondary';
        remove.textContent='Usuń z działu';
        form.append(remove);

        const template=document.getElementById('department-new-user');
        const create=template.content.firstElementChild.cloneNode(true);
        create.querySelector('[data-department-role]').textContent=accountRoleNames[type];
        create.onsubmit=async event=>{
          event.preventDefault();
          const button=event.submitter;
          button.disabled=true;
          try {
            const fields=Object.fromEntries(new FormData(create));
            const result=await communicationRequest({},{...fields,roles:[type],department,dealerGroup:groupName,createOnly:true},'/api/users');
            await loadDepartmentSettings(false);
            status.textContent=result.invitation==='sent'?'Dodano użytkownika i wysłano zaproszenie.'
              :'Dodano użytkownika. Wysyłka zaproszenia się nie udała.';
          } catch(error) {status.textContent=error.message;}
          finally {button.disabled=false;}
        };
        section.append(create);
      }
      form.onsubmit=async event=>{
        event.preventDefault();
        const button=event.submitter??save;
        button.disabled=true;
        try {
          await communicationRequest({},{action:asHead?'department-manager':'department-staff',
            group:groupName,department,person:Number(picker.value),remove:button.value==='remove'});
          await loadDepartmentSettings(asHead);
          status.textContent='Zapisano zmiany.';
        } catch(error) {status.textContent=error.message;}
        finally {button.disabled=false;}
      };
      return section;
    }));
    status.textContent=departments.length?'':asHead?'Dodaj dział w sekcji „Dodaj salon lub dział”.':'Brak działów do zarządzania.';
  } catch(error) {status.textContent=error.message;}
}
function openDepartmentSettings(asHead) {
  accountMenu.open=false;
  document.getElementById('department-settings-forms').replaceChildren();
  document.getElementById('department-settings-status').textContent='Wczytuję działy…';
  departmentDialog.showModal();
  void loadDepartmentSettings(asHead);
}
departmentMenu.onclick=()=>openDepartmentSettings(false);
if (departmentAdmin) departmentAdmin.onclick=()=>openDepartmentSettings(true);

document.addEventListener('visibilitychange',updateCommunicationCount);
setInterval(updateCommunicationCount,20000);
