/* Fireworks Finale (designs/song-language-wow.html, option A).
   "Light up the castle" plays the trip song; the photo fades to night and
   fireworks burst over the castle on the song's beats. Switching language
   launches a rocket from that language's chip.

   The beats are precomputed, not measured live: ENV is the song's loudness in
   50 ms frames (one character each, 64 levels) and PEAKS are the frames where
   it jumps. An AnalyserNode reads zeros from file:// and costs a decode; this
   costs 9 KB. Regenerate both if assets/bad-times.mp3 ever changes. */
(() => {
  const card = document.getElementById('tcard'), btn = document.getElementById('tc-song'),
        audio = document.getElementById('tc-audio'), cv = card && card.querySelector('.tc-fx');
  if (!card || !btn || !audio || !cv) return;
  const icon = btn.querySelector('.tc-ic');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  const ENV='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACEGHHEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACEDDEEEEEEFFFFFFFFFEFFEEEFFFFFEFFDEEEFDEEEEEFFFFFGJMNPRUUUWaYQFEXadVHKWMDDEJJGHFDBBBCEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACGJKLLLJIIHHIIHHHIHHIIIIHHHHIIJJJKKLMNOMKLKLKKMMHHEBCAAAAAAABAAABBBAAABCBCBABBCBCCDDDDCDDDDEDCCDDCDCCCCDDDEEDDFFGHHGFGFFGEEEDDEFGGFEGHGFCEGGFDCDCDBAAAAABCBAAAAAAAAABBBBBBCDDDDDFEDEDDEDCDDDECCDCCBABABCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACCAECAFDDEDFJHFJGBBAABAAAU76jWUUUQfcYz5nVUbebcaY04mYXageecav7qYWYbbZZXv4sWTWWUacar8uZRVgdabXr5wbZTdZZcYl8xaYTeZYVTn-1USUUSMbcg81gSPXcYYTZ83hTPUecXVX75kUQWdbZXT75mWUUTMYeV48pUSUfbZXQ47sWVQjdccWy9saWXfaabWlMDBBDVTKMHpPAAAAUPHEClUAAACYRHFEgYAABAWUJFEcdCBAAOVMOKUlBAAAUXRJGNnKGLIRbNYWNnNLWOScNXXKsFAABIXRLNHrHCAAMaQGECqIAABJXRGEDpLEACGYTLIFkVOTPJRRPUPjYLMOJXUQQMfcIMNCXOITRQQWZZJFLHQEb_5kZWUTMbfZ66nTSRbaYYR86jRSTecbXU18rWUOcaXWN47qVUTTOTeXx8tXVPdabWRy-yWUQfYcfXq7vfXMbZbaUq9zcYUQQMfdh_2dSOZecaUd_6hURYgdcZa-5gUPWdbZWW_7mUUUXSagX78lUSShdbYQ7-pXWSeZdeV04scVPcYbYS07qaUSRPTdYx8xXUKcaZWRv-vXTMbcaXVn_zaVNecZXUl_1dVURSIdch_4iSNXbceZd-5jbTXebfdW64mZWRbYbcW-4lUTUaRYdW48nVTQdZYXQ87sUTOebYYPz-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_0cPRRTUPPd9ziPICBBBAc_6lQPMMGTPO42nOJPPNLLN62mPJONMLKHx2oSKNRPMNKx5tSKLMKQRNm5vUDIQPSTUo81bHHHJIECf9zcLJGFEEAf-3jONLKHROS60kKHRQONKQ84oPGPQNLKGy3rQIPWPNMH66vYLMLIQPKq5xdRMacTcai4scWJMMGAAc8wWBAFVVXWl9-0VPPNKUQU73lKGPTRMNU-4qQIPSQNNN14qQGPWSPPH75uULNSNPPKx6vZNNQONLHv6yeXVQKAQSm_0fPPJAAAAm--sXUQLMSQZ90jJHUXSOPd_4mNJRWTQPN32pNHTWUQON97tSMNRQQOH17vUNOOQQQO2_xUBCLLIOMq80ZIIJLHIHw_2gNONNOURc82fMJTSQQQh_4gLMXWVTRW84jPQRUUTRX_7qPOOOKRRM37rQMMWUOPM7_xPBBIIJMKv_xWIIIIJJG0_3WKKLLPSOh_1cJFYVOMNm_6eHESSNNNW_4hIGVVOOLa_8mKIJPGQQR88sNGRTNQQQ78rZVLMKNPOx7wZPAHHHDC7-xaROPOPPOp-2UFTphVPKq_1YFEGEFEEa_5bEDDCCBBh_6kEBDBBBDV35lRKMONQOa95rWGMVQHCL07tbSJXabZY47xQOPPOONKw_wSDQhWNJGu8zUCDDDCCBg_0ZBAGBAAAm_8eCAEAAAAU_4hBALBAAAc85nVSNNSPQV47qKBSTSTZZ68rXPRRSQPLz_wNGZjcPJF0_xRBCMICBBp-2VCGUcZZYu_2gSCPNDBBb84iYHWZMABe_0jQNOYZbbe56hFCGZYSWb71kUWnuhZWa0tiZYlqeYVWwlcXVgrdYWVobTWYfhXXXYlQMZAObRbZWfVXhXOdQbdNUVXfYZbYYUCIOVYMCNGFGAg-4qbaVYSjfh9_tVUVcbcbd_-vbUSXZZaU5_uXTRaYYZU8_0dWZafhjjr8vgaMcYWWUw_2gURMNNNQm-1hGFESUSOn_7jTVXVPdcf65pSTTaZYZe_9nMVQYbabX17uNWSYaZaX89wZXWZbcfYv7yaVRcddebz_yeYSRUTSQp86bCCTVTVSt_3iXTUWVaai77fQRUWXWYj_5kRRTWVXWa68mQTSYYYYa98tSSSVSZYY28vRTRZaZYX49yTVWYbbcas_xZTXWcbcbqaNPTWVXaZciaLPUWWZbaclhMNSWWYaYadfKOTVUXZXYcqHIIJHKLLMQjIJMMLNIRRNqPISNISNNSKhSFROIVRNUNy_0dWXYYUcap84fURZbZdZr_2bTSYaZbag76lVTXZYZYg_5oVVWVPbcb48pTSTZaYXZ97sTWRXZYYT09xQYWaZXaR29zZUWWUTdWs-ydUQXaZZYu93UWSZaYdZk-2dUTXYYZXm96kVXVVRcbd75pVSSaXaad-9mUXXfcfeW36xbcSccceX56sZXRVTTWTw90WXTTUTWT0_0cURSUSWUp94cWTVXTYVs_4hXXTWSZWg67hWVTYVYXi_6oWVTYVXXY48pUSRWTUVW97vXVVXSWcV07vZVSYYZaT27zZULYXVXSq8ydVQXYZZWs85eWYZbPaZj82iQMXbZbbk71cGAFIKIGBFEBBAFLLHDa-4iKGFDATNP42jHAQQKHFK01jJANQKHEDv4mMDMPKGDAv2pQDDDAMNJo5uTABYWTOIn9wYCCFGFFFd6zZCAAEHECe_zdGFEBATMT20eFAPNJGEP3xgGAOPKGEIy1kKDOQLGDA16pNEEIKSSKt4rQALVVPIDt7uTAAQVSJFj7uXBAABAAAj9zaJIHGHNKY6ycGEPPKJGX5zeFBLMJGGM20hGDILHEDL43nLDEMPVVLv4oLAIYZYXVy4tRBBRUKCAr6sVIIOMKHEr8wVFEDCNSMe6vYECQNIGEd5xZCARNKHET5zgFCRMIGEU62hIDRbafZQ03rTCOTRONJ23mMBNchgfUv6uNAEXYXSNx7uUadcgacfo4vTWVbdadbo8waVTZbcabf31eRTYcbccg8zjSUchfifb11dJQUddcdb44oRRVcZaXQ07rPEKTTTTO19wZYbcfaeer5uYVTceceds6xaWRadbbcj5xWRPYbcbdj60dSWZZWaed30gTVWdeddd31fQSTUSSQS03oSORYgffc24rZaacbabYv7sUVSdcdcaz9xUVXacabao_vVQUUWUUVq70XQTUVVVVh5ydRUTTSTTj72cNOPPQPPY63iMNPPONOV_7mVVWVWVUV45mTRTUUVTS01iTRTTUUUStxhTTUVXYXXnoeYYblcXYYnncUZVsYTTUnlaWWctdRFGnpYRQPwcOLNe31hVVVVSYbZ46qWUTdcdbZ9-qYXRZaYZSy8qQWRabbbX49vYWXZccecq5waVKaZZWTs5tbULKKJKJl6zWDHLTRPIm_3hZZWWQbeb36kVRXaZYYc_6oVTUaZZXU17nYURabYcW67qUUUXZbfWv5tZWRcdcday9xaVRTVUUOp9zWJMVXXXWs91cUUUVWWVf83cRPVXYYYi_5gSTVZYZYY64iRTVZaaac65kQRRVWXXT07pNOQabYYX18uRPNOOMLKs-uQDFKNIFFx9yZUTTUScai8ydVNXbYYVq93dVOXZZYWd5zhVRXZZYZf63hWXSXTccZ22kVTScZcdY8-pVPNUMTQOx6sSKKSJORLz3pWTSVRTZXs9vWVLYZXYSx9zaTNYaYYSm-zcUNXZZYVn91dTUTUPdZe5zhUNWZYZZg-6iTUUaZXXX52mSQRXXYWX57mUTQTNWbWx6qUTOXWXYT0-sWUNYXWXTq8xVSOXYXXUs_waRRWWQbYk6zaTLWXXVWi91hTPPNOSNZ30eMJEDADEY93nSRRRLXXW16lTOOWWUXS77oRQQWWXVSv3oTRMYWVVQx5rVQRRSSaYp8vZPKYXWXSr-zdQLQSQSOh8yZEAEDKIDg_3hSUSTKYYa60hPMTYZXUX65mROPaaYYVz3mQPPWXWVS17sUQRQPTcWs5saXVcZbYRu4udZNQPMONl9vUDKWVRNLl8ydXSPSTUUg8wZLNSTVSTf41bIHKFFEEU51fNOTSUTOT45fTVTVXXXVz2lXMOMMSRT14qTKMNFFEHu8pSNNWWXZYw4uWOPRRSQRn8tXJIMROLJn7xVJHJOPQQg6wZLKIHGHHf82bJHGGHGGS6zbGDECCJDU62eIGFGGGHO23hLDACBAAFwnQHDBCBCBCvoNBBGICBBAmpOAAAAAAAAinPAAAAAAAAhtTCAAAAAAFf0aFAABBCCCa3cIBADBAAAT2eHAADDCCCN2eJCCCCBBAFveHAARQJFCCqiLAAAAAAAAsmMAAKLJHGGoqQCCACAAAAnvRBAABAAAAmvWJFDDDCCBgxWEFENMJJIWyUFGGIIIIITsXGEFPNMJKRuZGEGHHIJIQqaKIEOSRRRToeTSJKLFDDGpfURIMSJDCCkfONMJQWXXVlgIBCDPRQRPkgSUTXmVRTSdeSTTVmXTQRfgQQSTnYSSSbmURSQlYRSSbgOdREhVRgTSiVdfJgYNjTUkUcfReZShNKlUafIdbDkZHvwoZUTXSSdWr1uVUKbZZcUs2vQRLXaZaWkzxbQIZZabYl2xeSXZZVcbcyvhULVXZaXd2zgTORZYYaXyujOPRZYXZX11nWVUYQZcXv1rTTKZbZcRy0tRRLZYcaTq1tUPIZYYcVs1waSTYWTdZl0vcUMYYbaYj1zdSNVYaYUd3weKJQTSRPe3ydNRPTSURY0ygPQPRRQQX3ygMMLNMMMQyzoNNMQQNOLz0mROQSSSRMtyrPLMNNMLJt3tSHILLKIFn2wUGFFKJIHm4ziXZYaOfeh2ygZTZghghd50aXVXfefgb0znaVUgffga30fScbeVZhYx1pbbRdcegY00nXdPfcegZsyuZXScZadavztNehdZSaVq2sTRLaYXXUl1wWQKTVSTSdzvZLJTWUTRd1xYKOONGZXUzxgOLRVUVTV0zjPMPWWXXQvxiPMNYVUUQy0oRPPQMTXTr0oSLIYYWUPu0sSLFXVWUPj1sWMHURPQNj2wVLLLLFTPa1uaJGQRQVWc0xdUSLLJKJSzuaIJHIGJKS0yiPPPPJTWTtykNMNXWTTQxynPPIUSSROozpTQIUUSUOryrTOQONIYSi0rWNHUUTSSj2wXKFNQQQOa1uaLMMPOPNa2xcOONNHUWTywgNMPTRSQT0yhMLLVSSSOtxmPNKUTRRNzznTOOUWWYPp1qUQIVVSSPp1tXQJWWVWSj0rVLGTWTSQj1vVIKKKLLLY0uZHIIJKKKZ3xbIKJKJIJQxxgHGGIIHHP2xgJHHHHHHJtxkIFEHKKMLvzlOKLKIHIIluoOKLMMMNIoxnVMQpkWRQetnOJLnkZQOYrjQJLkkaPNTojQFJdfYOMPifWIIWeYOLLfcUKITbXMJHZYTIGMXTMGESVPHFISQKEDNQNDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const PEAKS=[506,595,606,617,651,783,794,861,883,917,961,972,994,1061,1072,1083,1094,1105,1127,1149,1161,1216,1260,2325,2347,2768,3123,3350,3372,3428,3439,3461,3506,3517,3528,3539,3550,3562,3573,3584,3595,3606,3617,3628,3639,3651,3661,3673,3695,3706,3717,3728,3740,3750,3762,3773,3784,3795,3806,3817,3828,3839,3851,3862,3873,3884,3895,3906,3917,3928,3940,3951,3962,3973,3984,3995,4006,4017,4028,4039,4051,4062,4073,4084,4095,4106,4117,4128,4140,4162,4173,4184,4195,4206,4217,4229,4239,4251,4262,4273,4284,4295,4306,4328,4417,4439,4451,4462,4484,4495,4506,4528,4550,4584,4595,4617,4639,4773,4795,4817,4839,4873,4895,4928,4962,4973,4984,4995,5017,5039,5073,5128,5139,5150,5162,5173,5184,5195,5206,5217,5228,5239,5251,5262,5273,5284,5295,5306,5317,5328,5339,5350,5362,5384,5395,5406,5417,5428,5439,5461,5484,5573,5695,5728,5739,5750,5917,5928,5950,6006,6017,6028,6039,6095,6106,6117,6184,6195,6206,6217,6228,6239,6261,6306,6317,6328,6350,6361,6372,6384,6394,6428,6439,6450,6461,6472,6483,6506,6539,6550,6561,6572,6583,6594,6617,6628,6650,6661,6672,6683,6694,6705,6716,6727,6738,6761,6772,6783,6794,6805,6816,6827,6849,6872,6883,6894,6905,6927,7260,7282,7293,7304,7327,7338,7349,7571,7582,7604,7615,7693,7704,7804,7815,7826,7837,7849,7860];
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const LEVEL = Float32Array.from(ENV, c => ALPHA.indexOf(c) / 63), BEATS = new Set(PEAKS);
  const PAL = ['#FFD27A', '#FF7AC0', '#7FD8FF', '#B8FF8F', '#FFFFFF', '#C9A2FF', '#FF9F5A'],
        LANG_C = {en: '#FFD27A', es: '#FF7AC0', fr: '#7FD8FF'};
  const LOUD = .72, MAX_PARTICLES = 3000, ROCKET_FRAMES = 44;
  const pick = a => a[Math.random() * a.length | 0];

  /* ---------- particles on the card's canvas ---------- */
  const ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  let P = [], W = 1, H = 1;
  const fit = () => { W = cv.clientWidth || 1; H = cv.clientHeight || 1; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  new ResizeObserver(fit).observe(cv);
  fit();
  const add = p => { if (P.length < MAX_PARTICLES) P.push({age: 0, gravity: 0, drag: 1, size: 2, ...p}); };
  function burst(x, y, {n, color, speed, life, size, gravity, drag = .985}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = speed * (.3 + Math.random() * .8);
      add({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (.6 + Math.random() * .6),
           color: typeof color === 'function' ? color() : color, size: size * (.6 + Math.random() * .7),
           gravity, drag, twinkle: true});
    }
  }
  function step() {
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    const dead = [], born = [];
    P = P.filter(p => (++p.age < p.life) || (dead.push(p), false));
    for (const p of P) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity; p.x += p.vx; p.y += p.vy;
      if (p.trail) born.push({x: p.x, y: p.y, vx: (Math.random() - .5) * .4, vy: Math.random() * .6, life: 22, color: '#FFC977', size: 1.3, gravity: .01, drag: .96});
      const k = 1 - p.age / p.life;
      let a = Math.min(1, k * 1.6);
      if (p.twinkle && k < .5 && Math.random() < .35) a *= .15;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + .6 * k), 0, 6.283); ctx.fill();
    }
    born.forEach(add);
    dead.forEach(p => p.onDie && p.onDie(p));
    ctx.globalAlpha = 1;
  }
  function rocket(x0, y0, x1, y1, color) {
    add({x: x0, y: y0, vx: (x1 - x0) / ROCKET_FRAMES, vy: (y1 - y0) / ROCKET_FRAMES, life: ROCKET_FRAMES,
         color: '#FFE8B0', size: 2.2, trail: true,
         onDie: p => {
           burst(p.x, p.y, {n: 95, color: color || (() => pick(PAL)), speed: 3.7, life: 82, size: 2, gravity: .035});
           burst(p.x, p.y, {n: 26, color: '#fff', speed: 1.4, life: 40, size: 1.4, gravity: .02});
         }});
    run();
  }
  // Over the castle: the right two-thirds of the card, upper third of its height.
  const show = () => { const x = W * (.3 + Math.random() * .66), y = H * (.07 + Math.random() * .3); rocket(x + (Math.random() - .5) * 80, H, x, y, pick(PAL)); };

  /* ---------- one loop: song level -> orb glow, beats -> shells ---------- */
  let lvl = 0, lastF = -1, raf = 0;
  function frame() {
    raf = 0;
    const f = Math.floor(audio.currentTime * 20), target = audio.paused ? 0 : (LEVEL[f] || 0);
    lvl += (target - lvl) * (target > lvl ? .5 : .12);
    if (!audio.paused && f !== lastF) {
      // A small forward step only; a seek or the loop restarting skips the catch-up.
      if (lastF >= 0 && f > lastF && f - lastF < 10) for (let i = lastF + 1; i <= f; i++) if (BEATS.has(i)) { show(); if (Math.random() < .35) setTimeout(show, 150); }
      lastF = f;
    }
    if (!audio.paused && lvl > LOUD && Math.random() < .03) show();
    card.style.setProperty('--lvl', lvl.toFixed(3));
    step();
    if (!audio.paused || P.length || lvl > .01) run();
  }
  // ponytail: the loop sleeps when paused and the sky is empty, so an idle card costs nothing.
  function run() { if (!raf && !calm.matches) raf = requestAnimationFrame(frame); }

  btn.addEventListener('click', () => audio.paused ? audio.play().catch(() => {}) : audio.pause());
  audio.addEventListener('play', () => {
    btn.setAttribute('aria-pressed', 'true'); icon.textContent = '❚❚'; card.classList.add('tc-night');
    lastF = -1;
    if (!calm.matches) { show(); setTimeout(show, 320); }
    run();
  });
  audio.addEventListener('pause', () => { btn.setAttribute('aria-pressed', 'false'); icon.textContent = '▶'; card.classList.remove('tc-night'); });

  // i18n.js builds the switch inside the card; a rocket flies from the chip to the title.
  card.addEventListener('click', e => {
    const b = e.target.closest('.lang-sw button[data-lang]');
    if (!b) return;
    const copy = card.querySelector('.tc-in');
    copy.classList.remove('tc-swap'); void copy.offsetWidth; copy.classList.add('tc-swap');
    if (calm.matches) return;
    const c = card.getBoundingClientRect(), g = b.getBoundingClientRect(), t = card.querySelector('.tc-title').getBoundingClientRect();
    rocket(g.left - c.left + g.width / 2, g.top - c.top + g.height / 2, t.left - c.left + t.width * .55, t.top - c.top - 34, LANG_C[b.dataset.lang]);
  });
})();
