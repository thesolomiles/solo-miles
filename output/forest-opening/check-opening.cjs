const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const req = require('node:module').createRequire(path.join(process.cwd(), 'package.json'))
const ts = req('typescript'), THREE = req('three'), cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  const mod = {exports:{}}; cache.set(file,mod)
  if (file.endsWith('.json')) return mod.exports = JSON.parse(fs.readFileSync(file,'utf8'))
  const source = fs.readFileSync(file,'utf8').replaceAll('import.meta.env.DEV','false')
  const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const localRequire = id => {
    if (!id.startsWith('.')) return req(id)
    const base=path.resolve(path.dirname(file),id)
    const target=[base,base+'.ts',base+'.tsx',base+'.json'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())
    return load(target)
  }
  new Function('require','module','exports',compiled)(localRequire,mod,mod.exports)
  return mod.exports
}
const opening=load('src/state/forestOpening.ts'), config=load('src/config/forestOpening.ts')
const FOREST=load('src/config/forest.ts').FOREST, N=load('src/config/arcade.ts').NINJA_RUN
const obstacleModule=load('src/three/forest/forestObstacles.ts')
const E=load('src/config/forestEncounter.ts').FOREST_ENCOUNTER
const O=config.FOREST_OPENING
const source=fs.readFileSync('src/three/forest/ForestWorld.tsx','utf8')
const walkerSource=source.slice(source.indexOf('function Walker()'),source.indexOf('// --- World'))
const constants=source.slice(source.indexOf('const IDLE_TURN'),source.indexOf('function WalkerFigure'))
const compiled=ts.transpileModule(constants+'\n'+walkerSource.replaceAll('import.meta.env.DEV','false')+'\nmodule.exports=Walker',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
function walker(x=0,y=0,learned=false,obstacles=obstacleModule.obstaclesIn) {
  opening.resetForestOpening(learned)
  const refs=[], keys={left:false,right:false,jump:false,back:false,forward:false}, touch={dir:0,jump:false,crouch:false}
  const view={walkerX:x,walkerY:y,facing:1,camX:x}, game={dialogue:null,transition:null}, sounds=[]
  let frame
  const ctx={THREE,FOREST,N,O,OB:FOREST.obstacles,FOREST_ENCOUNTER:E,forestView:view,forestReveal:{perspective:false},forestTouch:touch,
    useForestOpening:opening.useForestOpening,noteForestDoubleJump:opening.noteForestDoubleJump,advanceForestOpening:opening.advanceForestOpening,
    forestFloorAt:config.forestFloorAt,constrainForestHollowX:config.constrainForestHollowX,
    useGame:{getState:()=>game},useForestEncounter:{getState:()=>({phase:'approach'})},isTypingTarget:()=>false,
    obstaclesIn:obstacles,playForestSfx:s=>sounds.push(...s),document:{activeElement:null,hidden:false},
    useRef:v=>{const r={current:v};refs.push(r);return r},useEffect:()=>{},useFrame:f=>frame=f,useKeyboardControls:()=>[null,()=>keys],
    WalkerFigure:()=>null,AirSteps:()=>null,require:req,module:{exports:{}},exports:{}}
  vm.runInNewContext(compiled,ctx)
  ctx.module.exports()
  refs[0].current=new THREE.Group(); refs[1].current=new THREE.Group()
  const state=refs[2].current; state.y=y; state.grounded=true
  return {view,state,keys,touch,game,sounds,step:dt=>frame({},dt),tick:(seconds,hz)=>{for(let i=0;i<Math.ceil(seconds*hz);i++) frame({},1/hz)}}
}
let passed=0
function check(name,fn) {fn();passed++;console.log('PASS '+name)}
check('Player tries alone, wisp approaches and observes, gesture precedes any written hint',()=>{
  opening.resetForestOpening()
  opening.advanceForestOpening(10,55,1,false,false)
  assert.equal(opening.useForestOpening.getState().phase,'watching')
  opening.advanceForestOpening(.01,55,-2.4,true,false)
  assert.equal(opening.useForestOpening.getState().phase,'stranded')
  opening.advanceForestOpening(10,55,-2.4,true,true)
  assert.equal(opening.useForestOpening.getState().phase,'stranded')
  assert.equal(opening.forestOpeningMotion.elapsed,0)
  for(const [phase,seconds,next] of [['stranded',O.strandedSecs,'investigate'],['investigate',O.investigateSecs,'observe'],['observe',O.observeSecs,'demonstrate']]) {
    opening.advanceForestOpening(seconds-.1,55,-2.4,true,false)
    assert.equal(opening.useForestOpening.getState().phase,phase)
    assert.equal(opening.useForestOpening.getState().doubleJump,false)
    assert.equal(opening.useForestOpening.getState().showHint,false)
    opening.advanceForestOpening(.11,55,-2.4,true,false)
    assert.equal(opening.useForestOpening.getState().phase,next)
  }
  assert.equal(opening.useForestOpening.getState().doubleJump,true)
  assert.equal(opening.useForestOpening.getState().showHint,false)
  opening.advanceForestOpening(O.demonstrationSecs,55,-2.4,true,false)
  assert.equal(opening.useForestOpening.getState().phase,'practice')
  opening.advanceForestOpening(O.hintDelaySecs-.1,55,-2.4,true,false)
  assert.equal(opening.useForestOpening.getState().showHint,false)
  const elapsed=opening.forestOpeningMotion.elapsed
  opening.advanceForestOpening(100,55,-2.4,true,true)
  assert.equal(opening.forestOpeningMotion.elapsed,elapsed)
  assert.equal(opening.useForestOpening.getState().showHint,false)
  opening.advanceForestOpening(.11,55,-2.4,true,false)
  assert.equal(opening.useForestOpening.getState().showHint,true)
})
check('Discovering the second jump during the gesture can escape before a tip appears',()=>{
  opening.resetForestOpening()
  opening.useForestOpening.setState({phase:'demonstrate',doubleJump:true})
  opening.noteForestDoubleJump()
  opening.advanceForestOpening(.1,60,0,true,false)
  assert.equal(opening.useForestOpening.getState().phase,'following')
  assert.equal(opening.useForestOpening.getState().showHint,false)
})
for (const hz of [20,30,60,120]) {
  check('Single jump and no air-step initially at '+hz+' Hz',()=>{
    const w=walker();w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(.2,hz)
    w.keys.jump=true;w.step(1/hz)
    assert.equal(w.state.airJumpsUsed,0);assert.equal(w.state.airSteps.length,0)
  })
  for (const dir of [-1,1]) check('Locked hollow escape blocks; taught escape works '+dir+' at '+hz+' Hz',()=>{
    const w=walker(dir>0?O.gap.right-FOREST.walkerHalfW:O.gap.left+FOREST.walkerHalfW,-O.gap.depth)
    w.keys[dir>0?'right':'left']=true
    w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(.8,hz)
    assert.ok(w.view.walkerX>=O.gap.left&&w.view.walkerX<=O.gap.right)
    assert.equal(w.state.mode,'free')
    w.tick(O.strandedSecs+O.investigateSecs+O.observeSecs+O.demonstrationSecs+.2,hz)
    assert.equal(opening.useForestOpening.getState().phase,'practice')
    w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(.24,hz)
    w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(1,hz)
    assert.equal(opening.useForestOpening.getState().phase,'following')
    assert.ok(dir>0?w.view.walkerX>O.gap.right:w.view.walkerX<O.gap.left)
    assert.equal(w.state.y,0)
  })
  check('Run jump across wide gap lands below at '+hz+' Hz',()=>{
    const w=walker(O.gap.left-1);w.keys.right=true;w.tick(.16,hz);w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(1.2,hz)
    assert.ok(w.view.walkerX<O.gap.right);assert.equal(w.state.y,-O.gap.depth)
    assert.notEqual(opening.useForestOpening.getState().phase,'following')
  })
  check('All authored obstacles pass with one jump at '+hz+' Hz',()=>{
    for (const o of O.obstacles) {
      const size=FOREST.obstacles.kinds[o.kind]
      const w=walker(o.x-size.w/2-FOREST.walkerHalfW-.25)
      w.keys.right=true;w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(1,hz)
      assert.ok(w.view.walkerX>o.x+size.w/2, o.kind+' did not clear')
      assert.equal(w.state.airJumpsUsed,0);assert.equal(w.state.mode,'free')
    }
  })
  check('No automatic climb against tall wall at '+hz+' Hz',()=>{
    const w=walker(0,0,false,()=>[{kind:'boulder',x:2,hw:.85,h:2.3,i:0}]);w.keys.right=true;w.tick(1,hz)
    assert.equal(w.state.mode,'free');assert.equal(w.state.y,0)
    w.keys.jump=true;w.step(1/hz);w.keys.jump=false;w.tick(.5,hz)
    assert.equal(w.state.mode,'free')
  })
  check('Held Space gives one jump; third press cannot triple jump at '+hz+' Hz',()=>{
    const w=walker(0,0,true);w.keys.jump=true;w.tick(.2,hz)
    assert.equal(w.state.airJumpsUsed,0)
    w.keys.jump=false;w.step(1/hz);w.keys.jump=true;w.step(1/hz)
    assert.equal(w.state.airJumpsUsed,1)
    const leap=w.state.leapSeq
    w.keys.jump=false;w.step(1/hz);w.keys.jump=true;w.step(1/hz)
    assert.equal(w.state.leapSeq,leap)
  })
  check('Touch impulses can trigger a second jump at '+hz+' Hz',()=>{
    const w=walker(0,0,true);w.touch.jump=true;w.step(1/hz);w.tick(.2,hz)
    w.touch.jump=true;w.step(1/hz);assert.equal(w.state.airJumpsUsed,1)
    w.game.dialogue={};const leap=w.state.leapSeq
    w.touch.jump=true;w.step(1/hz);assert.equal(w.state.leapSeq,leap)
  })
}
check('Reset clears progress and demonstration state',()=>{
  opening.resetForestOpening()
  assert.deepEqual(opening.useForestOpening.getState(),{phase:'watching',doubleJump:false,usedDoubleJump:false,showHint:false})
  assert.equal(opening.forestOpeningMotion.elapsed,0)
})
console.log(passed+' checks passed against the actual Walker callback and opening store')
check('Actual wisp stays quiet in background past old meet distance, then teaches and leads',()=>{
  opening.resetForestOpening()
  const ws=fs.readFileSync('src/three/forest/Wisps.tsx','utf8')
  const code=ts.transpileModule(ws.slice(ws.indexOf('export function WispGuide')).replace('export function','function').replaceAll('import.meta.env.DEV','false')+'\nmodule.exports=WispGuide', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
  let memo, calls=[]
  const view={walkerX:0,walkerY:0,camX:0,facing:1}
  const FV=load('src/systems/forestView.ts'), hash3=load('src/three/forest/forestAssets.ts').hash3
  const ctx={THREE,FOREST,E,O,forestView:view,forestFrame:FV.forestFrame,rateAt:FV.rateAt,hash3,
    useForestOpening:opening.useForestOpening,forestOpeningMotion:opening.forestOpeningMotion,wispJumpDemonstration:config.wispJumpDemonstration,
    useForestEncounter:{getState:()=>({phase:'approach'})},sstep:(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b),playWispCall:c=>calls.push(c),
    useThree:fn=>fn({size:{width:1100,height:840}}),useRef:v=>({current:v}),useMemo:fn=>{memo=fn();return memo},Wisp:()=>null,require:req,module:{exports:{}},exports:{}}
  vm.runInNewContext(code,ctx);ctx.module.exports()
  const out=new THREE.Vector3()
  for (let i=0;i<1000;i++) {view.walkerX=i*.052;view.camX=view.walkerX;memo.motion(i/60,out)}
  assert.equal(out.z,FOREST.wisp.watch.z);assert.equal(calls.length,0)
  opening.advanceForestOpening(.01,55,-2.4,true,false);view.walkerX=55;view.walkerY=-2.4
  let time=1000/60
  const run=seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++){time+=1/60;opening.advanceForestOpening(1/60,55,-2.4,true,false);memo.motion(time,out)}}
  run(O.strandedSecs-.2)
  assert.equal(out.z,FOREST.wisp.watch.z);assert.equal(calls.length,0)
  run(.3)
  assert.equal(opening.useForestOpening.getState().phase,'investigate')
  run(O.investigateSecs*.34)
  assert.ok(out.z < -8);assert.equal(calls.length,0)
  const pause=out.clone();run(O.investigateSecs*.06)
  assert.ok(out.distanceTo(pause)<.1,'First cautious pause should stay beside the trees')
  run(O.investigateSecs*.6+.2)
  assert.equal(opening.useForestOpening.getState().phase,'observe');assert.ok(out.z>-1)
  assert.ok(calls.includes('hello'))
  run(O.observeSecs+.1)
  assert.equal(opening.useForestOpening.getState().phase,'demonstrate')
  assert.equal(opening.useForestOpening.getState().showHint,false)
  opening.useForestOpening.setState({phase:'following',doubleJump:true});view.walkerY=0;view.walkerX=60;view.camX=60
  for(let i=0;i<60;i++){time+=1/60;memo.motion(time,out)}
  assert.ok(out.z>-1);assert.ok(calls.includes('giggle'))
})
check('Touch component re-arms swipes, Jump button emits one impulse, cleanup clears input',()=>{
  const touchSource=fs.readFileSync('src/ui/ForestTouch.tsx','utf8')
  let code=ts.transpileModule(touchSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const input={dir:0,jump:false,crouch:false},cleanups=[],store={setState:()=>{}}
  const customRequire=id=>id==='react'?{useRef:v=>({current:v}),useEffect:f=>cleanups.push(f())}:
    id.includes('systems/input')?{forestTouch:input}:id.includes('state/forestOpening')?{useForestOpening:fn=>fn({doubleJump:true})}:
    id.includes('state/store')?{useGame:store}:id.includes('config/forest')?{SOUTH_TRAIL:{leave:{}}}:
    id==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'}:req(id)
  const ctx={window:{innerWidth:390},require:customRequire,module:{exports:{}},exports:{}}
  ctx.exports=ctx.module.exports;vm.runInNewContext(code,ctx)
  const tree=ctx.module.exports.ForestTouch(),children=tree.props.children
  const surface=children[0].props,button=children[1].props
  surface.onPointerDown({pointerId:1,clientX:300,clientY:500,currentTarget:{setPointerCapture:()=>{}}})
  assert.equal(input.dir,1)
  surface.onPointerMove({pointerId:1,clientX:300,clientY:450});assert.equal(input.jump,true)
  input.jump=false
  surface.onPointerMove({pointerId:1,clientX:300,clientY:490})
  surface.onPointerMove({pointerId:1,clientX:300,clientY:440});assert.equal(input.jump,true)
  input.jump=false;button.onPointerDown({preventDefault:()=>{}});assert.equal(input.jump,true)
  input.jump=false;button.onClick({detail:1});assert.equal(input.jump,false)
  button.onClick({detail:0});assert.equal(input.jump,true)
  surface.onLostPointerCapture({pointerId:1});assert.equal(input.dir,0)
  cleanups.forEach(f=>f?.());assert.equal(input.dir,0);assert.equal(input.jump,false)
})
console.log('Total '+passed+' checks passed')
check('Hollow camera height stays fixed throughout a jump',()=>{
  const cameraSource=fs.readFileSync('src/three/OrthoRig.tsx','utf8')
  const branch=cameraSource.slice(cameraSource.indexOf('    if (forest) {'),cameraSource.indexOf('    forestCamera.restore()'))
  const view={walkerX:55,walkerY:-O.gap.depth,facing:1,camX:55+FOREST.lead,camY:-1.6,snap:false}
  const cam=new THREE.OrthographicCamera()
  const ctx={forest:true,dt:1/60,aspectNow:1.4,forestView:view,FOREST,THREE,cam,
    forestFloorAt:config.forestFloorAt,forestFrame:load('src/systems/forestView.ts').forestFrame,
    frustum:{current:{h:0,aspect:0}},applyFrustum:()=>{},forestQuat:new THREE.Quaternion(),forestCamera:{update:()=>{}}}
  vm.runInNewContext('this.checkFrame=()=>{'+branch+'}',ctx)
  const ys=[]
  for(const y of [-2.4,-1.8,-.8,-.7,-.1,.5,.7,.2,-.7,-1.5,-2.4]) {
    view.walkerY=y;ctx.checkFrame();ys.push(cam.position.y)
  }
  assert.ok(Math.max(...ys)-Math.min(...ys)<1e-9)
  view.walkerX=60;ctx.checkFrame();assert.ok(view.camY>-1.6)
})
console.log('Total '+passed+' checks passed including fixed hollow camera framing')

check('Foreground foliage scrolls consistently beside fixed banks in colour and mask passes',()=>{
  const part=source.slice(source.indexOf('const FG_DIST'),source.indexOf('// --- Light: shafts'))
  const code=ts.transpileModule(part+'\nmodule.exports=Foreground',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
  let assets,frame,ref
  const view={camX:48},ctx={THREE,FOREST,O,MAX_HALF:42,MARGIN:4,forestView:view,forestReveal:{perspective:false},CHARACTER_LAYER:2,
    foregroundTexture:()=>({tex:new THREE.Texture(),top:1,bottom:-2}),
    useRef:()=>ref={current:new THREE.Mesh()},useMemo:f=>assets=f(),useEffect:()=>{},useFrame:f=>frame=f,require:req,module:{exports:{}},exports:{}}
  vm.runInNewContext(code,ctx);ctx.module.exports()
  const width=92,coordinates=[]
  for(const camX of [0,48,52,55,59,65,55,48]) {
    view.camX=camX;frame();assets.tex.updateMatrix()
    const uv=new THREE.Vector2((51-camX)/width+.5,.5).applyMatrix3(assets.tex.matrix)
    coordinates.push(uv.x)
    assert.ok(Math.abs(uv.x-(51+camX*(FOREST.foreground.rate-1))/FOREST.foreground.tile)<1e-12)
    // The camera-following plane still puts the cut at the same world X.
    assert.equal(ref.current.position.x+(O.gap.left-camX),O.gap.left)
  }
  assert.ok(Math.max(...coordinates)-Math.min(...coordinates)>1)
  const cuts=[]
  for(const [mat,key] of [[assets.mat,'basic'],[assets.mask,'depth']]) {
    const shader={uniforms:{},vertexShader:THREE.ShaderLib[key].vertexShader,fragmentShader:THREE.ShaderLib[key].fragmentShader}
    mat.onBeforeCompile(shader)
    assert.ok(shader.vertexShader.includes('vOpeningX = (modelMatrix * vec4(position, 1.0)).x'))
    assert.ok(shader.fragmentShader.includes('#include <map_fragment>'))
    assert.ok(!shader.fragmentShader.includes('uOpeningUvShift'))
    assert.ok(shader.fragmentShader.includes('if (vOpeningX > 51.900'))
    cuts.push(shader.fragmentShader.slice(shader.fragmentShader.indexOf('float openingFray'),shader.fragmentShader.indexOf('discard;')+8))
  }
  assert.equal(cuts[0],cuts[1])
})
console.log('Total '+passed+' checks passed including scrolling foliage and fixed bank cuts')
check('Actual lesson HUD stays silent until delayed hint, then clears on escape',()=>{
  const hudSource=fs.readFileSync('src/ui/ForestEncounterHud.tsx','utf8')
  const code=ts.transpileModule(hudSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
  let state={phase:'stranded',doubleJump:false,showHint:false}
  const customRequire=id=>id==='react'?{useRef:v=>({current:v}),useEffect:()=>{},useLayoutEffect:()=>{}}:
    id==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'}:
    id.endsWith('state/store')?{useGame:fn=>fn({dialogue:null,transition:null})}:
    id.endsWith('state/forestOpening')?{useForestOpening:fn=>fn(state)}:
    id.endsWith('state/forestEncounter')?{useForestEncounter:fn=>fn({phase:'approach',stage:'idle',nearby:false}),forestReveal:{}}:
    id.endsWith('systems/device')?{IS_MOBILE:false}:id.endsWith('systems/input')?{isTypingTarget:()=>false}:req(id)
  const ctx={require:customRequire,module:{exports:{}},exports:{}}
  ctx.exports=ctx.module.exports;vm.runInNewContext(code,ctx)
  const lesson=()=>ctx.module.exports.ForestEncounterHud().props.children[0]
  for(const phase of ['stranded','investigate','observe','demonstrate','practice']) {
    state={phase,doubleJump:phase==='practice'||phase==='demonstrate',showHint:false}
    assert.equal(lesson(),false,phase+' should not display the tip')
  }
  state={phase:'practice',showHint:true};assert.equal(lesson().props.className,'forest-lesson')
  state={phase:'following',showHint:false};assert.equal(lesson(),false)
})
console.log('Total '+passed+' checks passed including gesture-first lesson pacing')
