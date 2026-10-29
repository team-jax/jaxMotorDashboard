export const SERVO_NAMES=['F1_1','F1_2','F2_1','F2_2','F3_1','F3_2','F_ROT','W_X','W_YAW','W_PITCH'];
export const degrees=rad=>rad*180/Math.PI;
export const radians=deg=>deg*Math.PI/180;
export const round=n=>Math.round(n*10)/10;
export function createMotors(){return [...Array.from({length:4},(_,i)=>({name:`AK45-${i+1}`,type:'ak',id:i+1,current:[10.2,-5.1,0,0][i]})),...SERVO_NAMES.map((name,id)=>({name,type:'servo',id,current:null}))].map(m=>({...m,draft:m.current??0,sent:null,joint:'',min:-15,max:15,status:'idle',scenario:'normal',error:'',speed:0,amps:0,temp:26,history:[]}));}
export function limitsFor(joint){return joint?{min:Math.ceil(degrees(joint.limit.lower)*10-0.001)/10,max:Math.floor(degrees(joint.limit.upper)*10+0.001)/10}:{min:-15,max:15};}
export function inRange(m,value){return value!==''&&Number.isFinite(Number(value))&&Number(value)>=m.min&&Number(value)<=m.max;}
export function clamp(m,n){return round(Math.min(m.max,Math.max(m.min,n)));}
export function canEdit(m,stopped){return !stopped&&m.scenario!=='offline'&&m.scenario!=='error';}
export function canSend(m,stopped){return !!m.joint&&canEdit(m,stopped);}
export function send(m,stopped){if(!m.joint)return {ok:false,message:'먼저 모터에 대응하는 3D 관절을 연결하세요. 연결 전에는 모델을 움직일 수 없습니다.'};if(!canSend(m,stopped))return {ok:false,message:stopped?'긴급 정지 중에는 전송할 수 없습니다.':m.scenario==='offline'?'모터 연결이 끊겼습니다.':'모터 오류를 해제한 뒤 다시 시도하세요.'};if(!inRange(m,m.draft))return {ok:false,message:'목표 각도가 허용 범위를 벗어났습니다.'};if(m.scenario==='failure'){m.error='명령 전송 실패';return {ok:false,message:`${m.name} 명령 전송에 실패했습니다. 다시 시도하세요.`};}m.error='';m.sent=round(m.draft);m.status=m.type==='servo'?'sent':Math.abs(m.current-m.sent)<.05?'reached':'moving';return {ok:true,message:m.type==='servo'?`${m.name} 목표 ${m.sent.toFixed(1)}° 전송 완료 · 실제 도달 여부는 알 수 없습니다.`:`${m.name} → ${m.sent.toFixed(1)}° 모의 명령을 전송했습니다.`};}
export function tickMotor(m,dt,stopped){let reached=false;if(!stopped&&m.scenario==='normal'&&m.status==='moving'){const diff=m.sent-m.current;const step=dt*7;m.current=round(Math.abs(diff)<=step?m.sent:m.current+Math.sign(diff)*step);if(Math.abs(m.current-m.sent)<.05){m.current=m.sent;m.status='reached';reached=true;}}
 m.speed=!stopped&&m.status==='moving'&&m.scenario==='normal'?Math.sign(m.sent-m.current)*420:0;m.amps=m.speed?1.8:0.12;m.temp=round(m.temp+(m.speed?dt*.04:-(m.temp-26)*dt*.015));return reached;}
export function statusOf(m,stopped){if(stopped)return '긴급 정지';if(m.scenario==='offline')return '연결 끊김';if(m.scenario==='error')return '모터 오류';if(m.error)return m.error;return {idle:'대기 중',moving:'이동 중',reached:'이동 완료',sent:'전송 완료 · 위치 미확인'}[m.status];}
