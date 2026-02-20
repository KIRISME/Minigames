function main() {
  const canvas = document.getElementById('game');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const healthFill = document.getElementById('health-fill');
  const hpText = document.getElementById('hp-text');
  const ctx = canvas.getContext('2d');

  // HTML menu overlay elements (keeps canvas menu for fallback)
  const menuOverlayEl = document.getElementById('menu-overlay');
  const menuWaveEl = document.getElementById('menu-wave');


  // Trigger a polished start: animate overlay fade then call startGame
  function _menuStartFromUI(){
    let wave = 1;
    if(menuWaveEl && menuWaveEl.value){
      wave = parseInt(menuWaveEl.value, 10) || 1;
    } else if(menuWaveInput){
      wave = parseInt(menuWaveInput, 10) || 1;
    }
    wave = Math.max(1, wave);
    if(!menuOverlayEl){ startGame(wave); return; }
    menuOverlayEl.classList.add('fade-out');
    menuOverlayEl.setAttribute('aria-hidden', 'true');
    menuOverlayEl.style.pointerEvents = 'none';
    setTimeout(()=>{ menuOverlayEl.style.display = 'none'; menuOverlayEl.classList.remove('fade-out'); startGame(wave); }, 360);
  }
  if(menuWaveEl){
    menuWaveEl.addEventListener('input', e => { menuWaveInput = (e.target.value || '1').replace(/[^0-9]/g,'') || '1'; });
    menuWaveEl.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); _menuStartFromUI(); } });
  }



  function fit() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = Math.min(720, Math.floor(rect.width * 0.7) || 640);
  }
  window.addEventListener('resize', fit);
  fit();

  // Entities
  const player = { x: canvas.width/2, y: canvas.height-80, r:8, speed:420, lives:3, score:0, maxHp:100, hp:100 };
  const keys = {};
  const playerBullets = [];
  const enemyBullets = [];
  const powerUps = [];
  const enemies = [];

  // global damage multiplier for enemy bullets
  const enemyDamageMultiplier = 2.5;

  let powerupTimer = 8 + Math.random()*6;
  let last = performance.now();
  let spawnTimer = 0;
  let enemyId = 0;
  let playerShootTimer = 0;
  let bossWarningTimer = 0;
  let bossWarningText = '';
  let playerBoosts = {};
  let activeBoss = null;
  // Wave / difficulty state
  let waveNumber = 1;
  let waveInProgress = false;
  let waveList = [];
  let waveSpawnTimer = 0;
  let interWaveTimer = 1.5;
  const dropChanceBase = 0.35;
  // Menu state
  let gameState = 'menu'; // 'menu' or 'playing'
  let menuWaveInput = '1';

  document.addEventListener('keydown', e=> {
    keys[e.key.toLowerCase()]=true;
    if(gameState === 'menu'){
      if(e.key === 'Enter'){
        // play the overlay fade then start
        _menuStartFromUI();
      } else if(e.key === 'Backspace'){
        menuWaveInput = menuWaveInput.slice(0,-1) || '1';
        if(menuWaveEl) menuWaveEl.value = menuWaveInput;
      } else if(/^\d$/.test(e.key)){
        if(menuWaveInput.length < 5) menuWaveInput += e.key;
        if(menuWaveEl) menuWaveEl.value = menuWaveInput;
      }
    }
  });
  document.addEventListener('keyup', e=> keys[e.key.toLowerCase()]=false);

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

  function spawnEnemy(forcedType=null, forcedBossType=null, forcedX=null, forcedY=null){
    const side = Math.floor(Math.random()*4);
    const t = Math.random();
    let type = forcedType || 'wanderer';
    // select boss type first if forced or random and none active
    let bossType = forcedBossType || null;
    if(!forcedType){
      if(t < 0.08 && !activeBoss){
        type = 'boss';
        const bossTypes = ['rapid', 'original', 'summoner'];
        bossType = bossTypes[Math.floor(Math.random()*bossTypes.length)];
        bossWarningTimer = 2;
        if(bossType === 'rapid') bossWarningText = '⚠ RAPID BOSS INCOMING ⚠';
        else if(bossType === 'summoner') bossWarningText = '⚠ SUMMONER BOSS INCOMING ⚠';
        else bossWarningText = '⚠ BALANCED BOSS INCOMING ⚠';
      } else if(t < 0.14) type = 'charger';
      // occasional extra enemy variants
      const extra = Math.random();
      if(extra < 0.06) type = 'sniper';
      else if(extra < 0.10) type = 'kamikaze';
      else if(extra < 0.14) type = 'shield';
      else if(t < 0.31) type = 'shooter';
      else if(t < 0.48) type = 'tank';
      else if(t < 0.65) type = 'bloater';
      else if(t < 0.85) type = 'gunner';
      else type = 'wanderer';
    }

    let r = 16, hp = 1, color = '#ff7b7b', speed = 60, shootTimer = 1.0;
    if(type === 'boss'){ r = 28; hp = 12; color = '#ffaa00'; speed = 20; shootTimer = 0.6; }
    if(type === 'charger'){ r = 12; hp = 1; color = '#ffb86b'; speed = 180; shootTimer = 0.6; }
    if(type === 'shooter'){ r = 18; hp = 2; color = '#ffd56b'; speed = 30; shootTimer = 0.8 + Math.random()*1.4; }
    if(type === 'sniper'){ r = 12; hp = 1; color = '#b0ff8a'; speed = 18; shootTimer = 0.8 + Math.random()*1.6; }
    if(type === 'tank'){ r = 22; hp = 4; color = '#c07bff'; speed = 22; shootTimer = 1.6 + Math.random()*1.4; }
    if(type === 'bloater'){ r = 14; hp = 2; color = '#ff8fb3'; speed = 28; shootTimer = 1.4 + Math.random()*1.2; }
    if(type === 'gunner'){ r = 10; hp = 1; color = '#8ad6ff'; speed = 36; shootTimer = 0.18 + Math.random()*0.06; }
    if(type === 'kamikaze'){ r = 10; hp = 1; color = '#ff4444'; speed = 240; shootTimer = 9999; }
    if(type === 'shield'){ r = 20; hp = 3; color = '#7bbcff'; speed = 24; shootTimer = 1.4 + Math.random()*1.2; }
    if(type === 'wanderer'){ r = 14; hp = 1; color = '#ff7b7b'; speed = 70; shootTimer = 1.0 + Math.random()*1.6; }

    const margin = 36;
    let x=0,y=0,vx=0,vy=0;
    if(side === 0){
      x = margin + Math.random()*(canvas.width - margin*2);
      y = -margin;
      vx = (Math.random()-0.5)*40;
      vy = speed + Math.random()*40;
    } else if(side === 2){
      x = margin + Math.random()*(canvas.width - margin*2);
      y = canvas.height + margin;
      vx = (Math.random()-0.5)*40;
      vy = -(speed + Math.random()*40);
    } else if(side === 1){
      x = canvas.width + margin;
      y = margin + Math.random()*(canvas.height - margin*2);
      vx = -(speed + Math.random()*40);
      vy = (Math.random()-0.5)*40;
    } else {
      x = -margin;
      y = margin + Math.random()*(canvas.height - margin*2);
      vx = (speed + Math.random()*40);
      vy = (Math.random()-0.5)*40;
    }

    const newEnemy = {id:++enemyId, x, y, r, vx, vy, hp, maxHp: hp, shootTimer, type, color, speed, healCooldown: 0, bossType};
    // scale HP by difficulty (increase each wave)
    const difficulty = 1 + Math.max(0, waveNumber-1) * 0.06;
    newEnemy.hp = Math.max(1, Math.ceil(newEnemy.hp * difficulty));
    newEnemy.maxHp = newEnemy.hp;
    // allow forced position
    if(forcedX != null) newEnemy.x = forcedX;
    if(forcedY != null) newEnemy.y = forcedY;
    enemies.push(newEnemy);
    if(type === 'boss') activeBoss = newEnemy;
  }

  function spawnPowerUp(){
    const margin = 40;
    const x = margin + Math.random()*(canvas.width - margin*2);
    const y = margin + Math.random()*(canvas.height - margin*2);
    const t = Math.random();

    // Rare full extra life
    if(t < 0.08){
      powerUps.push({ x, y, r: 12, type: 'life', amount: 1 });
      return;
    }

    // Heal pack (common)
    if(t < 0.45){
      powerUps.push({ x, y, r: 10, type: 'heal', amount: 30 });
      return;
    }

    // Boost power-up (beam removed)
    const boosts = ['multishot','firerate','bigshot','grow','split','pierce','explosive','shield'];
    const choice = boosts[Math.floor(Math.random() * boosts.length)];
    powerUps.push({ x, y, r: 11, type: 'boost', boostType: choice });
  }

  function buildWave(){
    waveList.length = 0;
    const difficulty = 1 + Math.max(0, waveNumber-1) * 0.06;
    // number of enemies grows with wave
    let count = 3 + Math.floor(1.6 * waveNumber);
    // cap count
    count = Math.min(count, 40);
    // include a boss every 5 waves
    if(waveNumber % 5 === 0){
      const bossTypes = ['rapid','original','summoner'];
      const btype = bossTypes[Math.floor(Math.random()*bossTypes.length)];
      waveList.push({type:'boss', bossType:btype});
      // make remaining smaller
      count = Math.max(3, Math.floor(count * 0.6));
    }
    const types = ['charger','shooter','tank','bloater','gunner','wanderer','sniper','kamikaze','shield'];
    for(let i=0;i<count;i++){
      const t = types[Math.floor(Math.random()*types.length)];
      waveList.push(t);
    }
    // prepare warning text summarizing the wave
    const counts = {};
    for(const w of waveList){
      const key = typeof w === 'string' ? w : w.type;
      counts[key] = (counts[key]||0)+1;
    }
    let parts = [];
    for(const k in counts){
      if(k === 'boss') parts.push('BOSS');
      else parts.push(k + ' x' + counts[k]);
    }
    bossWarningText = '⚔ Wave '+waveNumber+': ' + parts.join(', ');
    bossWarningTimer = 3.4;
    // after warning, wave will start
  }

  function update(dt){
    if(gameState === 'menu') return;
    let dx=0, dy=0;
    if(keys['arrowleft']||keys['a']) dx=-1;
    if(keys['arrowright']||keys['d']) dx=1;
    if(keys['arrowup']||keys['w']) dy=-1;
    if(keys['arrowdown']||keys['s']) dy=1;
    const len = Math.hypot(dx,dy)||1;
    player.x += (dx/len) * player.speed * dt;
    player.y += (dy/len) * player.speed * dt;
    player.x = clamp(player.x, player.r+4, canvas.width - player.r-4);
    player.y = clamp(player.y, player.r+4, canvas.height - player.r-4);

    // Wave & spawn logic: spawn enemies from waveList after warning
    const difficulty = 1 + Math.max(0, waveNumber-1) * 0.06;
    if(!waveInProgress){
      if(waveList.length === 0 && interWaveTimer <= 0){
        buildWave();
      }
      // countdown until wave starts (warning shown via bossWarningText)
      if(bossWarningTimer <= 0 && waveList.length > 0){
        // begin spawning
        waveInProgress = true;
        waveSpawnTimer = 0;
      }
      interWaveTimer -= dt;
    } else {
      // spawn from waveList at an interval reduced as difficulty increases
      waveSpawnTimer += dt;
      const baseInterval = 0.9;
      const interval = Math.max(0.18, baseInterval / (1 + (waveNumber-1)*0.04));
      if(waveSpawnTimer > interval && waveList.length > 0){
        waveSpawnTimer = 0;
        const next = waveList.shift();
        if(typeof next === 'string') spawnEnemy(next);
        else spawnEnemy(next.type, next.bossType);
      }
      // wave ends when we've spawned all and no enemies remain
      if(waveList.length === 0 && enemies.length === 0){
        waveInProgress = false;
        waveNumber++;
        interWaveTimer = 2.0;
        bossWarningText = '✓ Wave cleared';
        bossWarningTimer = 1.6;
      }
    }

    powerupTimer -= dt;
    if(powerupTimer <= 0){ spawnPowerUp(); powerupTimer = 8 + Math.random()*10; }

    bossWarningTimer -= dt;
    if(bossWarningTimer < 0) bossWarningText = '';

    // decay active boosts (stored as arrays)
    for(const k of Object.keys(playerBoosts)){
      playerBoosts[k] = playerBoosts[k].filter(t => (t - dt) > 0);
      playerBoosts[k].forEach((_, i) => playerBoosts[k][i] -= dt);
      if(playerBoosts[k].length === 0) delete playerBoosts[k];
    }

    playerShootTimer -= dt;
    if(playerShootTimer <= 0){
      const has = t => playerBoosts[t] && playerBoosts[t].length > 0;
      const count = t => (playerBoosts[t] && playerBoosts[t].length) || 0;
      playerShootTimer = has('firerate') ? 0.08 : 0.36;
      if(enemies.length){
        let nearest = enemies[0];
        let best = Math.hypot(nearest.x-player.x, nearest.y-player.y);
        for(const e of enemies){
          const d = Math.hypot(e.x-player.x, e.y-player.y);
          if(d<best){ best=d; nearest=e; }
        }
        const ang = Math.atan2(nearest.y-player.y, nearest.x-player.x);
        const speed = 520;
        // determine bullet base properties from active boosts
        let baseR = 4, baseDamage = 1;
        const props = {};
        if(has('bigshot')){ baseR = 8; baseDamage = 3; }
        if(has('grow')){ props.grow = true; props.growRate = 24; props.maxR = 34; baseR = Math.max(baseR,6); }
        if(has('split')){ props.split = true; props.life = 0; props.splitAfter = 0.36; baseR = Math.max(baseR,5); }
        if(has('pierce')) props.pierce = true;
        if(has('explosive')) props.explosive = true;
        // multishot can stack: N multishots = 3^N bullets
        const multishotCount = count('multishot');
        if(multishotCount > 0){
          for(let ms=0; ms<multishotCount; ms++){
            const spread = 0.15;
            for(let k=-1;k<=1;k++){
              const a = ang + k*spread + ms*0.08;
              playerBullets.push(Object.assign({x:player.x, y:player.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, r:baseR, damage:baseDamage}, props));
            }
          }
        } else {
          playerBullets.push(Object.assign({x:player.x, y:player.y, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, r:baseR, damage:baseDamage}, props));
        }
      } else {
        const has = t => playerBoosts[t] && playerBoosts[t].length > 0;
        const count = t => (playerBoosts[t] && playerBoosts[t].length) || 0;
        playerShootTimer = has('firerate') ? 0.08 : 0.36;
        const speed = 520;
        let baseR = 4, baseDamage = 1;
        const props = {};
        if(has('bigshot')){ baseR = 8; baseDamage = 3; }
        if(has('grow')){ props.grow = true; props.growRate = 24; props.maxR = 34; baseR = Math.max(baseR,6); }
        if(has('split')){ props.split = true; props.life = 0; props.splitAfter = 0.36; baseR = Math.max(baseR,5); }
        if(has('pierce')) props.pierce = true;
        if(has('explosive')) props.explosive = true;
        const multishotCount = count('multishot');
        if(multishotCount > 0){
          for(let ms=0; ms<multishotCount; ms++){
            for(let k=-1;k<=1;k++){
              const spread = 0.15;
              playerBullets.push(Object.assign({x:player.x, y:player.y, vx: Math.sin(k*spread)*speed*0.3, vy:-speed, r:baseR, damage:baseDamage}, props));
            }
          }
        } else {
          playerBullets.push(Object.assign({x:player.x, y:player.y, vx:0, vy:-520, r:baseR, damage:baseDamage}, props));
        }
      }
    }

    for(let i=playerBullets.length-1;i>=0;i--){
      const b = playerBullets[i]; b.x += b.vx*dt; b.y += b.vy*dt;
      if(b.split){
        b.life = (b.life || 0) + dt;
        if(b.life >= b.splitAfter){
          const baseAng = Math.atan2(b.vy, b.vx);
          const speed = Math.hypot(b.vx, b.vy);
          for(let k=-1;k<=1;k++){
            const a = baseAng + k*0.28;
            playerBullets.push({x: b.x, y: b.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, r:4, damage:1});
          }
          playerBullets.splice(i,1);
          continue;
        }
      }

      if(b.grow){
        b.r += (b.growRate || 12) * dt;
        if(b.maxR && b.r > b.maxR) b.r = b.maxR;
        b.damage = Math.max(1, Math.floor(b.r / 6));
      }

      if(b.x<-50||b.x>canvas.width+50||b.y<-50||b.y>canvas.height+50) playerBullets.splice(i,1);
    }

    for(let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      // All enemies move toward player
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.vx = Math.cos(ang)*e.speed;
      e.vy = Math.sin(ang)*e.speed;
      e.x += e.vx*dt;
      e.y += e.vy*dt;
      
      // Boss heals itself
      if(e.type === 'boss'){
        e.healCooldown -= dt;
        if(e.healCooldown <= 0 && e.hp < e.maxHp){
          e.hp = Math.min(e.maxHp, e.hp + 2);
          e.healCooldown = 3;
        }
      }

      e.shootTimer -= dt;
      e.shotPattern = (e.shotPattern || 0);
      if(e.shootTimer <= 0){
        const willFire = (e.type === 'shooter' || e.type === 'tank' || e.type === 'bloater' || e.type === 'gunner' || e.type === 'boss') || Math.random() < 0.06;
        if(willFire){
          if(e.type === 'boss') e.shootTimer = 0.7;
          else if(e.type === 'tank') e.shootTimer = 1.6 + Math.random()*1.4;
          else if(e.type === 'bloater') e.shootTimer = 1.0 + Math.random()*1.2;
          else if(e.type === 'gunner') e.shootTimer = 0.12 + Math.random()*0.06;
          else e.shootTimer = 0.8 + Math.random()*1.2;
          
          const ang = Math.atan2(player.y - e.y, player.x - e.x);
          
          if(e.type === 'boss'){
            // Initialize boss-specific state
            if(!e.bossState) e.bossState = { shotCount: 0, inCooldown: false };
            
            if(e.bossType === 'rapid'){
              // Rapid multi-growing: fires 3 growing bullets, takes break
              if(e.bossState.inCooldown){
                // Cooldown period over, reset to fire again
                e.bossState.inCooldown = false;
                e.bossState.shotCount = 0;
                e.shootTimer = 0.35;  // Ready to fire next volley
              } else {
                // Fire phase: 3 growing bullets
                const s = 180;
                const spread = 0.18;
                for(let k=-1;k<=1;k++){
                  const a = ang + k*spread;
                  const baseD = 2;
                  enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:7, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), grow:true, growRate:20, maxR:30});
                }
                e.bossState.shotCount++;
                if(e.bossState.shotCount >= 2){
                  // After 2 volleys, enter cooldown
                  e.bossState.inCooldown = true;
                  e.shootTimer = 1.5 + Math.random()*0.5;
                } else {
                  // Fire again soon
                  e.shootTimer = 0.35;
                }
              }
            } else if(e.bossType === 'summoner'){
              // Summoner: ONLY spawns enemies, no shooting
              e.shootTimer = 0.5;
              // Spawn an enemy every 0.5 seconds
              const spawnTypes = ['charger', 'shooter', 'tank', 'bloater', 'gunner'];
              const spawnType = spawnTypes[Math.floor(Math.random()*spawnTypes.length)];
              const angle = Math.random() * Math.PI * 2;
              const dist = 80;
              const sx = e.x + Math.cos(angle)*dist;
              const sy = e.y + Math.sin(angle)*dist;
              
              let r = 16, hp = 1, color = '#ff7b7b', speed = 60;
              if(spawnType === 'charger'){ r = 12; hp = 1; color = '#ffb86b'; speed = 180; }
              else if(spawnType === 'shooter'){ r = 18; hp = 2; color = '#ffd56b'; speed = 30; }
              else if(spawnType === 'tank'){ r = 22; hp = 4; color = '#c07bff'; speed = 22; }
              else if(spawnType === 'bloater'){ r = 14; hp = 2; color = '#ff8fb3'; speed = 28; }
              else if(spawnType === 'gunner'){ r = 10; hp = 1; color = '#8ad6ff'; speed = 36; }
              
              let shootTimer = 0.6;
              if(spawnType === 'charger') shootTimer = 0.6;
              else if(spawnType === 'shooter') shootTimer = 0.8 + Math.random()*1.4;
              else if(spawnType === 'tank') shootTimer = 1.6 + Math.random()*1.4;
              else if(spawnType === 'bloater') shootTimer = 1.4 + Math.random()*1.2;
              else if(spawnType === 'gunner') shootTimer = 0.18 + Math.random()*0.06;
              
              const vx = (Math.random()-0.5)*40;
              const vy = (Math.random()-0.5)*40;
              enemies.push({id:++enemyId, x:sx, y:sy, r, vx, vy, hp, maxHp: hp, shootTimer, type: spawnType, color, speed, healCooldown: 0});
            }
            else {
              // 'original' type: cycling pattern (existing logic)
              e.shotPattern = (e.shotPattern + 1) % 10;
              if(e.shotPattern === 0){
                // tank-like: 3 bullets spread
                const s = 220;
                const spread = 0.22;
                for(let k=-1;k<=1;k++){
                  const a = ang + k*spread;
                  const baseD = 1;
                  enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:6, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
                }
              } else if(e.shotPattern === 1){
                // growing bullet (single)
                const s = 120;
                const baseD = 2;
                enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:6, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), grow:true, growRate:24, maxR:34});
              } else if(e.shotPattern === 2){
                // split bullet
                const s = 140;
                const baseD = 1;
                enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:5, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), split:true, life:0, splitAfter:0.36});
              } else if(e.shotPattern === 3){
                // large projectile
                const s = 160;
                const baseD = 3;
                enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:10, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
              } else if(e.shotPattern === 4){
                // fast small bullets (gunner style)
                const s = 260;
                const baseD = 1;
                enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:3, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
              } else if(e.shotPattern === 5){
                // normal bullet
                const s = 200;
                const baseD = 1;
                enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:5, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
              } else if(e.shotPattern === 6){
                // mixed: multi-shot growing bullets (minigun)
                const s = 180;
                const spread = 0.15;
                for(let k=-1;k<=1;k++){
                  const a = ang + k*spread;
                  const baseD = 2;
                  enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:7, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), grow:true, growRate:20, maxR:30});
                }
              } else if(e.shotPattern === 7){
                // mixed: multi-shot split bullets
                const s = 150;
                const spread = 0.2;
                for(let k=-1;k<=1;k++){
                  const a = ang + k*spread;
                  const baseD = 1;
                  enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:5, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), split:true, life:0, splitAfter:0.4});
                }
              } else if(e.shotPattern === 8){
                // mixed: multi-shot fast bullets (rapid spread)
                const s = 240;
                const spread = 0.18;
                for(let k=-2;k<=2;k++){
                  const a = ang + k*spread;
                  const baseD = 1;
                  enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:3, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
                }
              } else {
                // mixed: large projectile spread
                const s = 150;
                const spread = 0.3;
                for(let k=-1;k<=1;k++){
                  const a = ang + k*spread;
                  const baseD = 2;
                  enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:8, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
                }
              }
            }
          } else if(e.type === 'tank'){
            const s = 220;
            const spread = 0.22;
            for(let k=-1;k<=1;k++){
              const a = ang + k*spread;
              const baseD = 1;
              enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r:6, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
            }
          } else if(e.type === 'shooter'){
            const s = 160;
            if(Math.random() < 0.32){
              const baseD = 3;
              enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:10, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
            } else {
              const baseD = 1;
              enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:5, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
            }
          } else if(e.type === 'bloater'){
            const s = 120;
            const baseD = 2;
            enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:6, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), grow:true, growRate:24, maxR:34});
          } else if(e.type === 'gunner'){
            const s = 260;
            const baseD = 1;
            enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:3, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
          } else if(e.type === 'wanderer'){
            const s = 140;
            const baseD = 1;
            enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:5, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier)), split:true, life:0, splitAfter:0.36});
          } else {
            const s = 200;
            const baseD = 1;
            enemyBullets.push({x: e.x, y: e.y, vx: Math.cos(ang)*s, vy: Math.sin(ang)*s, r:5, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
          }
        } else {
          e.shootTimer = 1.0 + Math.random()*1.6;
        }
      }

      if(e.x < -120 || e.x > canvas.width + 120 || e.y < -120 || e.y > canvas.height + 120){
        enemies.splice(i,1);
      }
    }

    for(let i=enemyBullets.length-1;i>=0;i--){
      const b = enemyBullets[i];
      b.x += b.vx*dt; b.y += b.vy*dt;
      
      if(b.split){
        b.life = (b.life || 0) + dt;
        if(b.life >= b.splitAfter){
          const baseAng = Math.atan2(b.vy, b.vx);
          const speed = Math.hypot(b.vx, b.vy);
          for(let k=-1;k<=1;k++){
            const a = baseAng + k*0.28;
            const baseD = 1;
            enemyBullets.push({x: b.x, y: b.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, r:4, damage: Math.max(1, Math.round(baseD * enemyDamageMultiplier))});
          }
          enemyBullets.splice(i,1);
          continue;
        }
      }

      if(b.grow){
        b.r += (b.growRate || 12) * dt;
        if(b.maxR && b.r > b.maxR) b.r = b.maxR;
        b.damage = Math.max(1, Math.floor(b.r / 6));
      }
      
      if(b.x<-80||b.x>canvas.width+80||b.y>canvas.height+80||b.y<-80) enemyBullets.splice(i,1);
    }


    for(let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];



      for(let j=playerBullets.length-1;j>=0;j--){
        const b = playerBullets[j];
        const dx = b.x - e.x, dy = b.y - e.y;
        if(dx*dx+dy*dy < (b.r+e.r)*(b.r+e.r)){
          // apply bullet effects (pierce/explosive) and damage
          const dmg = b.damage || 1;
          if(b.explosive){
            const parts = 6;
            const speed = 260;
            for(let k=0;k<parts;k++){
              const a = k * (Math.PI*2) / parts;
              playerBullets.push({x: e.x, y: e.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, r:3, damage:1});
            }
          }
          e.hp -= dmg;
          if(!b.pierce) playerBullets.splice(j,1);
          if(e.hp <= 0){
            if(e.type === 'boss'){
              powerUps.push({x: e.x - 15, y: e.y, r: 12, type: 'life', amount: 1});
              powerUps.push({x: e.x + 15, y: e.y, r: 10, type: 'heal', amount: 50});
              player.score += 100;
              activeBoss = null;
            } else {
              player.score += 10;
              // Type-specific power-up drops: give player the enemy's ability when possible
              const typeToBoost = (t)=>{
                // Map enemy types to player boost abilities
                // Supported boosts: 'multishot', 'firerate', 'bigshot', 'grow', 'split', 'pierce', 'explosive', 'shield'
                if(t === 'tank') return 'multishot';
                if(t === 'gunner') return 'firerate';
                if(t === 'shooter') return 'bigshot';
                if(t === 'bloater') return 'grow';
                if(t === 'wanderer') return 'split';
                if(t === 'sniper') return 'pierce';
                if(t === 'kamikaze') return 'explosive';
                if(t === 'shield') return 'shield';
                // charger, boss, and unknown types drop healing
                return null;
              };
              const boost = typeToBoost(e.type);
              // only drop power-up sometimes; chance increases slightly with wave
              const dropChance = Math.min(0.85, dropChanceBase + (waveNumber-1)*0.02);
              if(Math.random() < dropChance){
                if(boost){
                  powerUps.push({x: e.x, y: e.y, r: 11, type: 'boost', boostType: boost});
                } else {
                  powerUps.push({x: e.x, y: e.y, r: 10, type: 'heal', amount: 30});
                }
              }
            }
            enemies.splice(i,1);
            scoreEl.textContent = player.score;
          }
          break;
        }
      }
    }

    for(let i=enemyBullets.length-1;i>=0;i--){
      const b = enemyBullets[i];
      const dx = b.x - player.x, dy = b.y - player.y;
      if(dx*dx+dy*dy < (b.r+player.r)*(b.r+player.r)){
        enemyBullets.splice(i,1);
        let dmg = b.damage || 1;
        const shieldCount = (playerBoosts['shield'] && playerBoosts['shield'].length) || 0;
        if(shieldCount > 0) dmg = Math.max(1, Math.floor(dmg * Math.pow(0.5, shieldCount)));
        player.hp -= dmg;
        if(player.hp <= 0){ player.lives -= 1; livesEl.textContent = player.lives; player.hp = player.maxHp; player.x = canvas.width/2; player.y = canvas.height-80; if(player.lives <= 0) { gameState = 'menu'; } }
        const pct = Math.max(0, player.hp) / player.maxHp * 100;
        healthFill.style.width = pct + '%';
        hpText.textContent = Math.max(0, Math.floor(player.hp)) + '/' + player.maxHp;
      }
    }

    for(let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      const dx = e.x - player.x, dy = e.y - player.y;
      if(dx*dx+dy*dy < (e.r+player.r)*(e.r+player.r)){
        enemies.splice(i,1);
        let contactDmg = Math.max(4, Math.floor(e.r/2));
        const shieldCount = (playerBoosts['shield'] && playerBoosts['shield'].length) || 0;
        if(shieldCount > 0) contactDmg = Math.max(1, Math.floor(contactDmg * Math.pow(0.5, shieldCount)));
        player.hp -= contactDmg;
        if(player.hp <= 0){ player.lives -= 1; livesEl.textContent = player.lives; player.hp = player.maxHp; player.x = canvas.width/2; player.y = canvas.height-80; if(player.lives <= 0) { gameState = 'menu'; } }
        const pct = Math.max(0, player.hp) / player.maxHp * 100;
        healthFill.style.width = pct + '%';
        hpText.textContent = Math.max(0, Math.floor(player.hp)) + '/' + player.maxHp;
      }
    }

    for(let i=powerUps.length-1;i>=0;i--){
      const p = powerUps[i];
      const dx = p.x - player.x, dy = p.y - player.y;
      if(dx*dx+dy*dy < (p.r+player.r)*(p.r+player.r)){
        let shouldConsume = false;
        if(p.type === 'heal'){
          player.hp = Math.min(player.maxHp, player.hp + p.amount);
          const pct = player.hp / player.maxHp * 100;
          healthFill.style.width = pct + '%';
          hpText.textContent = Math.floor(player.hp) + '/' + player.maxHp;
          shouldConsume = true;
        } else if(p.type === 'life'){
          player.lives += p.amount;
          livesEl.textContent = player.lives;
          shouldConsume = true;
        } else if(p.type === 'boost'){
          // stack boosts: add another timer for 8 seconds
          if(!playerBoosts[p.boostType]) playerBoosts[p.boostType] = [];
          playerBoosts[p.boostType].push(8);
          shouldConsume = true;
        }
        if(shouldConsume) powerUps.splice(i,1);
      }
    }
  }

  function draw(){
    if(gameState === 'menu'){
      drawMenu();
      return;
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#071028'; ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.beginPath(); ctx.fillStyle = '#7fe7a3'; ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0b3b2d'; ctx.fillRect(player.x-3, player.y-1, 6, 2);

    for(const e of enemies){
      ctx.beginPath(); ctx.fillStyle = e.color || '#ff7b7b'; ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
      // Decorations per enemy type
      ctx.save();
      ctx.translate(e.x, e.y);
      const angToPlayer = Math.atan2(player.y - e.y, player.x - e.x);
      if(e.type === 'boss'){
        // crown
        ctx.fillStyle = '#ffd36b';
        for(let k=-2;k<=2;k++){
          const a = -Math.PI/2 + k*0.5;
          ctx.beginPath(); ctx.moveTo(Math.cos(a)*(e.r-2), Math.sin(a)*(e.r-2)); ctx.lineTo(Math.cos(a+0.25)*(e.r+8), Math.sin(a+0.25)*(e.r+8)); ctx.lineTo(Math.cos(a+0.5)*(e.r-2), Math.sin(a+0.5)*(e.r-2)); ctx.fill();
        }
      } else if(e.type === 'charger'){
        // forward spike
        ctx.fillStyle = '#ffcf9b';
        const a = angToPlayer;
        ctx.beginPath(); ctx.moveTo(Math.cos(a)*(e.r), Math.sin(a)*(e.r)); ctx.lineTo(Math.cos(a+0.25)*(e.r+10), Math.sin(a+0.25)*(e.r+10)); ctx.lineTo(Math.cos(a-0.25)*(e.r+10), Math.sin(a-0.25)*(e.r+10)); ctx.fill();
      } else if(e.type === 'shooter'){
        // small turret
        ctx.save(); ctx.rotate(angToPlayer);
        ctx.fillStyle = '#b87b2b'; ctx.fillRect(e.r-2, -4, 8, 8);
        ctx.restore();
      } else if(e.type === 'tank'){
        // turret + treads
        ctx.save(); ctx.rotate(angToPlayer);
        ctx.fillStyle = '#8a5be6'; ctx.fillRect(-6, -e.r-6, 12, 6);
        ctx.fillStyle = '#6b4bd1'; ctx.fillRect(-e.r, e.r-4, e.r*2, 4);
        ctx.restore();
      } else if(e.type === 'bloater'){
        // small bubbles
        ctx.fillStyle = 'rgba(255,140,180,0.9)';
        ctx.beginPath(); ctx.arc(-e.r*0.6, -e.r*0.4, 3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r*0.5, -e.r*0.3, 4,0,Math.PI*2); ctx.fill();
      } else if(e.type === 'gunner'){
        // multiple muzzles
        ctx.fillStyle = '#4fb6ff';
        for(let k=-1;k<=1;k++){ ctx.beginPath(); ctx.arc(Math.cos(angToPlayer)*(e.r+6) - k*4, Math.sin(angToPlayer)*(e.r+6), 2,0,Math.PI*2); ctx.fill(); }
      } else if(e.type === 'wanderer'){
        // little antenna
        ctx.fillStyle = '#ffd6d6'; ctx.beginPath(); ctx.arc(0, -e.r-4, 2,0,Math.PI*2); ctx.fill(); ctx.fillRect(-1, -e.r, 2, 6);
      } else if(e.type === 'sniper'){
        // crosshair overlay
        ctx.strokeStyle = '#88ffdd'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-e.r-6,0); ctx.lineTo(-e.r-2,0); ctx.moveTo(e.r+6,0); ctx.lineTo(e.r+2,0);
        ctx.moveTo(0,-e.r-6); ctx.lineTo(0,-e.r-2); ctx.moveTo(0,e.r+6); ctx.lineTo(0,e.r+2); ctx.stroke();
      } else if(e.type === 'kamikaze'){
        // fuse / flame behind based on velocity
        const vx = e.vx || 0, vy = e.vy || 0; const backAng = Math.atan2(-vy, -vx);
        ctx.fillStyle = '#ff7744'; ctx.beginPath(); ctx.moveTo(Math.cos(backAng)*(e.r+2), Math.sin(backAng)*(e.r+2)); ctx.lineTo(Math.cos(backAng+0.6)*(e.r+12), Math.sin(backAng+0.6)*(e.r+12)); ctx.lineTo(Math.cos(backAng-0.6)*(e.r+12), Math.sin(backAng-0.6)*(e.r+12)); ctx.fill();
      } else if(e.type === 'shield'){
        // shield ring
        ctx.strokeStyle = 'rgba(100,180,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,e.r+6, -0.5, Math.PI*2 -0.5); ctx.stroke();
      }
      ctx.restore();
      if(e.maxHp > 1){
        const w = Math.max(20, e.r*1.8);
        const pct = Math.max(0, e.hp) / e.maxHp;
        ctx.fillStyle = '#222'; ctx.fillRect(e.x - w/2, e.y - e.r - 10, w, 6);
        ctx.fillStyle = '#ffe16a'; ctx.fillRect(e.x - w/2, e.y - e.r - 10, w * pct, 6);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(e.x - e.r, e.y + e.r + 4, e.r*2, 4);


    }

    for(const p of powerUps){
      if(p.type === 'heal'){
        ctx.fillStyle = '#7fffb3'; ctx.fillRect(p.x-9,p.y-9,18,18);
        ctx.fillStyle = '#0b3b2d'; ctx.fillRect(p.x-3,p.y-3,6,6);
      } else if(p.type === 'life'){
        ctx.fillStyle = '#ff6b9d'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('1UP', p.x, p.y+5);
        ctx.textAlign = 'left';
      } else if(p.type === 'boost'){
        const map = {
          multishot: {color: '#ffff00', text: '3X'},
          firerate: {color: '#ff00ff', text: 'RAPID'},
          bigshot: {color: '#ff9b00', text: 'BIG'},
          grow: {color: '#ff66aa', text: 'GROW'},
          split: {color: '#66d6ff', text: 'SPLT'},
          pierce: {color: '#88ffdd', text: 'PIER'},
          explosive: {color: '#ffcc66', text: 'BMB'},
          shield: {color: '#66ff88', text: 'SHLD'},
        };
        const meta = map[p.boostType] || {color: '#ccc', text: '??'};
        ctx.fillStyle = meta.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(meta.text, p.x, p.y+4);
        ctx.textAlign = 'left';
      }
    }

    ctx.fillStyle = '#bfe1ff';
    for(const b of playerBullets){ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); }
    for(const b of enemyBullets){
      ctx.beginPath();
      if(b.grow) ctx.fillStyle = '#ff9bb0'; else ctx.fillStyle = '#ffd56b';
      ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    }


    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(8,8,140,36);
    ctx.fillStyle = '#dff'; ctx.font = '14px system-ui'; ctx.fillText('Score: '+player.score, 16, 28);

    const activeBoosts = Object.keys(playerBoosts);
    if(activeBoosts.length){
      const metaMap = {
        multishot: {color: 'rgba(255,255,0,0.6)', label: '3X SHOT'},
        firerate: {color: 'rgba(255,0,255,0.6)', label: 'RAPID FIRE'},
        bigshot: {color: 'rgba(255,155,0,0.6)', label: 'BIG SHOT'},
        grow: {color: 'rgba(255,102,170,0.6)', label: 'GROWING SHOT'},
        split: {color: 'rgba(102,214,255,0.6)', label: 'SPLIT SHOT'},
        pierce: {color: 'rgba(136,255,221,0.6)', label: 'PIERCE'},
        explosive: {color: 'rgba(255,204,102,0.6)', label: 'EXPLOSIVE'},
        shield: {color: 'rgba(102,255,136,0.6)', label: 'SHIELD'},
      };
      // draw small labels centered
      const gap = 130;
      const totalW = activeBoosts.length * gap;
      for(let i=0;i<activeBoosts.length;i++){
        const k = activeBoosts[i];
        const meta = metaMap[k] || {color: 'rgba(200,200,200,0.6)', label: k};
        const timers = playerBoosts[k] || [];
        const x = canvas.width/2 - totalW/2 + i*gap;
        ctx.fillStyle = meta.color; ctx.fillRect(x-56, 0, 112, 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
        const label = timers.length > 1 ? meta.label + ' x' + timers.length : meta.label;
        const maxTime = Math.max(...timers);
        ctx.fillText(label + ' (' + maxTime.toFixed(1) + 's)', x, 14);
        ctx.textAlign = 'left';
      }
    }

    if(bossWarningText){
      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = 'rgba(255,100,100,' + Math.max(0, bossWarningTimer/2) + ')';
      ctx.textAlign = 'center';
      ctx.fillText(bossWarningText, canvas.width/2, canvas.height/2);
      ctx.textAlign = 'left';
    }
  }

  function resetGame(startWave=1){
    enemies.length = 0; playerBullets.length = 0; enemyBullets.length = 0; powerUps.length = 0;
    activeBoss = null;
    player.lives = 3; player.score = 0; scoreEl.textContent='0'; livesEl.textContent='3';
    player.x = canvas.width/2; player.y = canvas.height-80;
    waveNumber = startWave;
    waveList.length = 0;
    waveInProgress = false;
    playerBoosts = {};
  }

  function startGame(startWave){
    // ensure overlay hidden (safety) and switch to playing
    if(menuOverlayEl){ menuOverlayEl.style.display = 'none'; menuOverlayEl.classList.remove('fade-out'); menuOverlayEl.setAttribute('aria-hidden','true'); }
    gameState = 'playing';
    resetGame(startWave);
  }

  function drawMenu(){
    // keep HTML overlay visible while in menu
    if(menuOverlayEl){
      menuOverlayEl.style.display = 'flex';
      menuOverlayEl.classList.remove('fade-out');
      if(menuWaveEl) menuWaveEl.value = menuWaveInput;
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#071028'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('SHOOTER', canvas.width/2, 80);
    ctx.font = '20px system-ui'; ctx.fillStyle = '#aaa';
    ctx.fillText('Enter Starting Wave (Difficulty)', canvas.width/2, 140);
    // Input box
    const boxX = canvas.width/2 - 80, boxY = canvas.height/2 - 50, boxW = 160, boxH = 60;
    ctx.fillStyle = '#334455'; ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 3; ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(menuWaveInput || '1', canvas.width/2, canvas.height/2 - 20);
    ctx.fillStyle = '#666'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Press ENTER to start', canvas.width/2, canvas.height/2 + 20);
    ctx.fillText('Higher waves = harder difficulty', canvas.width/2, canvas.height/2 + 50);
  }

  function loop(now){
    const dt = Math.min(0.033, (now - last)/1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  }

  /* EOF - script end (temporarily commented to diagnose) */
  main();
