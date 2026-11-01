import {SequencePlayer,validateSteps} from './sequence.js?v=20261102-sequence-1';
const $=id=>document.getElementById(id);
const STORAGE='jax-model-sequence-v1';
export function mountSequence(hooks){
 let steps=[],repeat=false;
 try{const saved=JSON.parse(localStorage.getItem(STORAGE)??'null');if(saved&&Array.isArray(saved.steps)&&saved.steps.length<=100){steps=saved.steps;repeat=!!saved.repeat;}}catch{/* Invalid preferences do not prevent the dashboard from loading. */}
 let editing=-1,lastState='idle';
 const player=new SequencePlayer([],step=>{hooks.setSpeed(step.speed);hooks.refresh();});
 function save(){try{localStorage.setItem(STORAGE,JSON.stringify({steps,repeat}));}catch{hooks.toast('브라우저에 시퀀스를 저장하지 못했습니다.','warning');}}
 function report(error){$('sequence-error').textContent=error instanceof Error?error.message:String(error);}
 function capture(){return {name:`자세 ${steps.length+1}`,speed:hooks.getSpeed(),wait:1,angles:Object.fromEntries(hooks.getControls().map(m=>[m.joint,m.draft]))};}
 function edit(index){
  if(player.busy||hooks.isStopped())return;
  editing=index;const step=steps[index];$('sequence-step-name').value=step.name;$('sequence-step-speed').value=step.speed;$('sequence-step-wait').value=step.wait;$('sequence-edit-error').textContent='';
  $('sequence-angle-fields').replaceChildren();for(const m of hooks.getControls()){
   const label=document.createElement('label');label.className='batch-field';const text=document.createElement('span');text.textContent=m.name;const small=document.createElement('small');small.textContent=`${m.min.toFixed(1)}° ~ ${m.max.toFixed(1)}°`;text.append(small);const input=document.createElement('input');input.type='number';input.step='.1';input.min=m.min;input.max=m.max;input.value=step.angles[m.joint]??m.draft;input.dataset.joint=m.joint;input.setAttribute('aria-label',m.name+' 단계 목표 각도');label.append(text,input);$('sequence-angle-fields').append(label);
  }$('sequence-editor').showModal();
 }
 function renderRows(){
  const host=$('sequence-steps');host.replaceChildren();
  if(!steps.length){const p=document.createElement('p');p.className='sequence-empty';p.textContent='목표 각도를 설정하고 “현재 목표 자세 추가”를 누르세요. 단계를 편집해 각도·속도·도착 후 대기 시간을 정할 수 있습니다.';host.append(p);}
  steps.forEach((step,index)=>{
   const row=document.createElement('article');row.className='sequence-step';row.dataset.index=index;
   const number=document.createElement('span');number.className='sequence-number';number.textContent=String(index+1);
   const detail=document.createElement('div');detail.className='sequence-step-detail';const title=document.createElement('strong');title.textContent=step.name;const subtitle=document.createElement('small');subtitle.textContent=`${Object.keys(step.angles??{}).length}개 관절 · 속도 ${step.speed}% · 도착 후 ${step.wait}초 대기`;detail.append(title,subtitle);
   const actions=document.createElement('div');actions.className='sequence-step-actions';
   function button(text,description,action,disabled=false){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',`${index+1}단계 ${description}`);b.dataset.fixedDisabled=String(disabled);b.disabled=disabled;b.onclick=()=>{if(player.busy||hooks.isStopped())return;try{action();$('sequence-error').textContent='';}catch(e){report(e);}};actions.append(b);}
   button('미리보기','미리보기',()=>{validateSteps([step],hooks.getControls());hooks.chooseModel();hooks.getControls().forEach(m=>m.draft=step.angles[m.joint]);hooks.setSpeed(step.speed);hooks.refresh();});
   button('편집','편집',()=>edit(index));
   button('↑','위로 이동',()=>{[steps[index-1],steps[index]]=[steps[index],steps[index-1]];save();renderRows();},index===0);
   button('↓','아래로 이동',()=>{[steps[index+1],steps[index]]=[steps[index],steps[index+1]];save();renderRows();},index===steps.length-1);
   button('복제','복제',()=>{if(steps.length>=100)throw Error('최대 100단계까지 추가할 수 있습니다.');steps.splice(index+1,0,structuredClone(step));save();renderRows();});
   button('삭제','삭제',()=>{steps.splice(index,1);save();renderRows();});row.append(number,detail,actions);host.append(row);
  });renderStatus();
 }
 function renderStatus(){
  const unavailable=hooks.isStopped()||!hooks.getControls().length,busy=player.busy;
  $('sequence-add').disabled=unavailable||busy||steps.length>=100;$('sequence-play').disabled=unavailable||!steps.length||player.state==='playing';$('sequence-play').textContent=player.state==='paused'?'▶ 계속 재생':'▶ 처음부터 재생';$('sequence-pause').disabled=player.state!=='playing';$('sequence-stop').disabled=!busy;$('sequence-repeat').disabled=unavailable||busy;$('sequence-repeat').checked=repeat;
  $('sequence-steps').querySelectorAll('button').forEach(b=>b.disabled=unavailable||busy||b.dataset.fixedDisabled==='true');
  $('sequence-steps').querySelectorAll('.sequence-step').forEach(row=>row.classList.toggle('active',busy&&Number(row.dataset.index)===player.index));
  const progress=$('sequence-progress');progress.max=Math.max(1,steps.length);progress.value=player.state==='completed'?steps.length:Math.max(0,player.index+(player.phase==='waiting'?1:0));
  $('sequence-status').textContent=hooks.isStopped()?'긴급 정지 · 재생 중단':player.state==='paused'?`일시정지 · ${player.index+1} / ${steps.length}단계`:player.state==='playing'?`${player.index+1} / ${steps.length}단계 · ${player.phase==='waiting'?`도착 후 대기 ${player.remaining.toFixed(1)}초`:'이동 중'}`:player.state==='completed'?'모든 단계 재생 완료':player.state==='stopped'?`중지 · ${player.reason}`:`${steps.length}단계 · 브라우저 자동 저장`;
 }
 $('sequence-add').onclick=()=>{if(player.busy||hooks.isStopped())return;try{if(!hooks.prepareCapture())throw Error('현재 목표 각도 입력을 먼저 확인하세요.');const step=capture();validateSteps([step],hooks.getControls());steps.push(step);save();renderRows();$('sequence-error').textContent='';}catch(e){report(e);}};
 $('sequence-repeat').onchange=()=>{repeat=$('sequence-repeat').checked;save();};
 $('sequence-play').onclick=()=>{
  if(hooks.isStopped())return;
  try{if(player.state==='paused')player.resume();else{validateSteps(steps,hooks.getControls());hooks.chooseModel();player.controls=hooks.getControls();player.start(steps,repeat);}lastState=player.state;$('sequence-error').textContent='';hooks.refresh();renderStatus();}catch(e){report(e);}
 };
 $('sequence-pause').onclick=()=>{player.pause();hooks.refresh();renderStatus();};
 $('sequence-stop').onclick=()=>{player.stop();hooks.refresh();renderStatus();};
 $('sequence-edit-save').onclick=()=>{
  try{if(player.busy||hooks.isStopped())throw Error('재생을 중지한 뒤 편집하세요.');const name=$('sequence-step-name').value.trim();if(!name)throw Error('단계 이름을 입력하세요.');const speedRaw=$('sequence-step-speed').value,waitRaw=$('sequence-step-wait').value;if(!speedRaw.trim()||!waitRaw.trim())throw Error('속도와 대기 시간을 입력하세요.');const angles={};for(const input of $('sequence-angle-fields').querySelectorAll('input')){if(!input.value.trim())throw Error('모든 관절의 각도를 입력하세요.');angles[input.dataset.joint]=Number(input.value);}const next={name:name.slice(0,60),speed:Number(speedRaw),wait:Number(waitRaw),angles};validateSteps([next],hooks.getControls());steps[editing]=next;save();renderRows();$('sequence-editor').close();}catch(e){$('sequence-edit-error').textContent=e.message;}
 };
 $('sequence-edit-stop').onclick=()=>{$('sequence-editor').close();hooks.emergencyStop();};
 renderRows();
 return {player,renderStatus,update(dt){player.update(dt);if(lastState!==player.state){lastState=player.state;hooks.refresh();if(player.state==='completed')hooks.toast('시퀀스 재생을 완료했습니다.');}},emergencyStop(){if(player.busy)player.stop('긴급 정지');renderStatus();}};
}
