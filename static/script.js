const $ = s => document.querySelector(s);
const EMO = {
  sadness:['😢','#5b8def'], joy:['😂','#ffc53d'], love:['❤️','#ff5c8a'],
  anger:['😡','#ff5040'], fear:['😨','#a98bff'], surprise:['😲','#2fd5c4']
};
const EXAMPLES = [
  'I feel so happy and excited',
  'Nobody came to my party and I feel empty',
  'How dare you lie to my face again',
  'I heard footsteps behind me in the dark',
  'Wow, I never expected this gift!',
  'I would do anything for her'
];
const input=$('#input'), go=$('#go'), card=$('#card'), result=$('#result');
const root=document.documentElement, C=2*Math.PI*52;
let busy=false;

// build example chips + probability rows once
EXAMPLES.slice(0,4).forEach(t=>{
  const b=document.createElement('button'); b.type='button'; b.textContent=t.length>26?t.slice(0,24)+'…':t; b.title=t;
  b.onclick=()=>{input.value=t; input.dispatchEvent(new Event('input')); analyze();};
  $('#chips').append(b);
});
Object.entries(EMO).forEach(([k,[e,c]])=>{
  const li=document.createElement('li'); li.dataset.k=k; li.style.setProperty('--c',c);
  li.innerHTML=`<span>${e} ${k}</span><div class="t"><i></i></div><span class="v">0%</span>`;
  $('#bars').append(li);
});

// live character counter + spotlight following the pointer
input.addEventListener('input',()=>{ $('#count').textContent=`${input.value.length} / 2000`; });
card.addEventListener('pointermove',e=>{
  const r=card.getBoundingClientRect();
  card.style.setProperty('--mx',e.clientX-r.left+'px'); card.style.setProperty('--my',e.clientY-r.top+'px');
});
input.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter') analyze(); });
go.onclick=analyze;

// server status (Render free tier sleeps, so keep polling until it answers)
async function health(){
  try{
    const d=await (await fetch('/health')).json();
    if(!d.model_loaded) throw 0;
    $('#dot').className='ok'; $('#status').textContent='Model ready';
  }catch{
    $('#dot').className=''; $('#status').textContent='Waking up the model…'; setTimeout(health,4000);
  }
}
health();

async function analyze(){
  const text=input.value.trim();
  if(!text||busy) return;
  busy=true; go.disabled=true; go.classList.add('loading'); $('#err').textContent='';
  try{
    const r=await fetch('/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    if(!r.ok) throw new Error(r.status===503?'The model is still loading. Try again in a few seconds.':`Request failed (${r.status}). Check the server logs.`);
    render(await r.json());
  }catch(e){
    $('#err').textContent=e instanceof TypeError?'Cannot reach the server. Check your connection and try again.':e.message;
  }finally{ busy=false; go.disabled=false; go.classList.remove('loading'); }
}

function render(d){
  const [emoji,color]=EMO[d.predicted_emotion];
  root.style.setProperty('--accent',color);          // whole page shifts to the emotion's color
  result.hidden=false; result.classList.remove('show'); void result.offsetWidth; result.classList.add('show');

  const em=$('#emoji'); em.textContent=emoji; em.classList.remove('pop'); void em.offsetWidth; em.classList.add('pop');
  $('#label').textContent=d.predicted_emotion;
  $('#arc').style.strokeDashoffset=C*(1-d.confidence);
  countUp($('#pct'),d.confidence*100);

  document.querySelectorAll('#bars li').forEach(li=>{
    const p=d.all_probabilities[li.dataset.k]||0;
    li.classList.toggle('top',li.dataset.k===d.predicted_emotion);
    li.querySelector('i').style.width=(p*100)+'%';
    countUp(li.querySelector('.v'),p*100);
  });
  burst(emoji,em);
  result.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function countUp(el,to){
  const t0=performance.now();
  (function f(t){
    const k=Math.min(1,(t-t0)/1100), e=1-Math.pow(1-k,3);
    el.textContent=Math.round(to*e)+'%';
    if(k<1) requestAnimationFrame(f);
  })(t0);
}

function burst(emoji,anchor){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const r=anchor.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
  for(let i=0;i<16;i++){
    const s=document.createElement('span'), a=Math.random()*Math.PI*2, d=90+Math.random()*130;
    s.className='fx'; s.textContent=emoji; s.style.left=x+'px'; s.style.top=y+'px';
    s.style.setProperty('--dx',Math.cos(a)*d+'px'); s.style.setProperty('--dy',Math.sin(a)*d-40+'px');
    s.style.setProperty('--r',(Math.random()*120-60)+'deg');
    document.body.append(s); setTimeout(()=>s.remove(),1500);
  }
}
