const life=document.querySelector.bind(document);
const query=new URLSearchParams(location.search);
const role=query.get('role')??sessionStorage.getItem('lejek-active-role');
const preview=query.get('podglad');
const scopePicker=life('#scope');
const postDialog=life('#post-dialog');
const olderPosts=life('#older-posts');
let wall;
let loading=0;
let sending=false;

function lifeUrl(path,scope=wall?.current) {
  const params=new URLSearchParams();
  const activeRole=wall?.role??role;
  if (activeRole) params.set('role',activeRole);
  if (preview) params.set('podglad',preview);
  if (scope) {
    params.set('scope',scope.scope);
    params.set('name',scope.name);
  }
  return path+'?'+params;
}

async function requestLife(scope,body,before) {
  const options=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
  const url=lifeUrl('/api/salon-life',scope);
  const response=await fetch(before?url+'&before='+before:url,options);
  const result=await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}

function element(type,label,className) {
  const node=document.createElement(type);
  if (label) node.textContent=label;
  if (className) node.className=className;
  return node;
}

function lifeButton(label,fn,className='secondary') {
  const button=element('button',label,className);
  button.type='button';
  button.onclick=fn;
  return button;
}

function storyCard(post,draft=false) {
  const article=element('article','',draft||post===wall.hit?'':'card');
  article.append(element('h3',post.title));
  if (post.scope==='group'&&wall.current.scope==='salon') article.append(element('p','Grupa · '+post.audience,'hint'));
  if (post.day) {
    const date=new Date(post.day+'T12:00:00Z');
    const time=element('time',date.toLocaleDateString('pl-PL',{day:'numeric',month:'long'}));
    time.dateTime=post.day;
    if (post.author) {
      const byline=element('p',post.author+' · ','hint');
      byline.append(time);
      article.append(byline);
    } else article.append(time);
  }
  article.append(element('p',post.message));
  if (post.hasPhoto) {
    const image=element('img');
    image.loading='lazy';
    image.alt='Zdjęcie do wpisu: '+post.title;
    image.src=lifeUrl('/api/salon-life/photo')+'&id='+post.id;
    article.append(image);
  }
  if (wall.readOnly) return article;
  const actions=element('div','','actions');
  if (draft) {
    actions.append(lifeButton('Opublikuj mój wpis',()=>change({action:'publish-draft',id:post.id},'Wpis opublikowany.'),''));
  } else {
    const active=Boolean(post.reacted);
    const reaction=lifeButton((active?'❤️':'♡')+' '+(post.reactions??0),
      ()=>change({action:'react',id:post.id,active:!active}), 'secondary react');
    reaction.setAttribute('aria-label',active?'Cofnij polubienie':'Polub wpis');
    reaction.setAttribute('aria-pressed',String(active));
    actions.append(reaction);
    if (wall.current.moderate&&post.scope===wall.current.scope) {
      actions.append(lifeButton('Usuń wpis',()=>{
        if (confirm('Usunąć ten wpis ze ściany?')) change({action:'remove',id:post.id},'Wpis usunięty.');
      }));
    }
  }
  article.append(actions);
  return article;
}

function showWall() {
  const {scopes,current,posts,hit,drafts,poll,readOnly}=wall;
  scopePicker.replaceChildren(...scopes.map((item,index)=>new Option(
    (item.scope==='salon'?'Salon · ':'Grupa · ')+item.name,String(index))));
  scopePicker.value=String(scopes.findIndex(item=>item.scope===current.scope&&item.name===current.name));
  scopePicker.disabled=scopes.length<2;
  const panelRole=wall.role==='staff'?wall.roles.find(item=>item!=='staff'):wall.role;
  renderAccountHeader(wall,preview);
  if (panelRole) {
    const params=new URLSearchParams({role:panelRole});
    if (preview) params.set('podglad',preview);
    renderPanelTabs(life('#life-panel-nav'),panelRole,'wiecej',route=>'/daily.html?'+params+'#'+route);
  }
  life('#add-post').hidden=readOnly;
  life('#wall').hidden=false;
  life('#hit').hidden=!hit;
  life('#hit-post').replaceChildren(...(hit?[storyCard(hit)]:[]));
  const regularPosts=posts.filter(post=>post.id!==hit?.id);
  life('#feed-section').hidden=Boolean(hit)&&!regularPosts.length;
  olderPosts.hidden=!wall.hasOlder;
  life('#feed').replaceChildren(...(posts.length
    ?regularPosts.map(post=>storyCard(post))
    :[element('p','Na tej ścianie nie ma jeszcze wpisów.','card')]));
  life('#drafts').hidden=!drafts.length||readOnly;
  life('#draft-list').replaceChildren(...drafts.map(post=>storyCard(post,true)));
  life('#poll-editor').hidden=Boolean(poll)||!current.moderate||readOnly;
  if (!poll) {
    life('#ballot').replaceChildren(element('p','Na ten tydzień nie ma ankiety.','hint'));
  } else {
    const options=poll.options.map(({label,votes},choice)=>{
      const button=lifeButton('',()=>change({action:'vote',id:poll.id,choice},'Głos zapisany.'),'secondary poll-choice');
      button.append(element('span',label),element('strong',String(votes)));
      button.setAttribute('aria-pressed',String(poll.choice===choice));
      button.disabled=readOnly;
      return button;
    });
    life('#ballot').replaceChildren(element('h3',poll.question),...options);
  }
}

async function loadWall(scope,message='',before=null) {
  const revision=++loading;
  scopePicker.disabled=true;
  olderPosts.disabled=true;
  try {
    const next=await requestLife(scope,null,before);
    if (revision!==loading) return;
    if (before) next.posts=[...wall.posts,...next.posts];
    wall=next;
    showWall();
    life('#status').textContent=message;
  } catch(error) {
    if (revision!==loading) return;
    if (wall) showWall();
    life('#status').textContent=error.message;
  } finally { if (revision===loading) olderPosts.disabled=false; }
}

async function change(body,message='',status=life('#status')) {
  if (sending) return false;
  sending=true;
  const current=wall.current;
  const revision=loading;
  try {
    await requestLife(current,body);
    if (revision===loading) await loadWall(current,message);
    return true;
  } catch (error) {
    status.textContent=error.message;
    return false;
  } finally { sending=false; }
}

olderPosts.onclick=()=>loadWall(wall.current,'',wall.posts.at(-1).id);
scopePicker.onchange=()=>loadWall(wall.scopes[Number(scopePicker.value)]);
life('#add-post').onclick=()=>{
  life('#post-status').textContent='';
  life('#post-scope').textContent=(wall.current.scope==='group'?'Grupa i jej salony · ':'Tylko salon · ')+wall.current.name;
  postDialog.showModal();
};
life('#cancel-post').onclick=()=>{if (!sending) postDialog.close();};
postDialog.addEventListener('cancel',event=>{if (sending) event.preventDefault();});

async function photoData(file) {
  if (!file?.size) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15_000_000)
    throw Error('Wybierz zdjęcie JPG, PNG lub WebP o rozmiarze do 15 MB.');
  const image=await createImageBitmap(file).catch(()=>null);
  if (!image) throw Error('Nie udało się odczytać zdjęcia.');
  try {
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d');
    for (const size of [960,720,480]) {
      const ratio=Math.min(size/Math.max(image.width,image.height),1);
      canvas.width=Math.max(1,Math.round(image.width*ratio));
      canvas.height=Math.max(1,Math.round(image.height*ratio));
      context.fillStyle='#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      const photo=canvas.toDataURL('image/jpeg',.76);
      if (photo.length<=240_000) return photo;
    }
  } finally { image.close(); }
  throw Error('Nie udało się wystarczająco zmniejszyć zdjęcia.');
}

life('#post-form').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const submit=event.submitter??form.querySelector('[type="submit"], button:last-child');
  const values=new FormData(form);
  const status=life('#post-status');
  status.textContent='';
  if (submit) submit.disabled=true;
  try {
    const photo=await photoData(values.get('photo'));
    if (await change({action:'post',title:values.get('title'),message:values.get('message'),photo},'Wpis opublikowany.',status)) {
      form.reset();
      postDialog.close();
    }
  } catch (error) { status.textContent=error.message; }
  finally { if (submit) submit.disabled=false; }
};

life('#poll-form').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const values=new FormData(form);
  if (await change({action:'poll',question:values.get('question'),options:values.getAll('option').filter(option=>option.trim())},'Ankieta opublikowana.')) {
    form.reset();
    life('#poll-editor').open=false;
  }
};

loadWall(null);
