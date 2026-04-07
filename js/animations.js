/* ============================================================
   NEXVORA SYSTEMS — animations.js
   Scroll reveal (IntersectionObserver) + Three.js crystalline network
   Inspired by the Nexvora logo: geometric nodes, faceted crystals,
   teal/navy/green/gold palette from the crystalline "N" mark.
   ============================================================ */

// ── Scroll Reveal ──
(function () {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .stagger, .fade-in').forEach(el => io.observe(el));
})();

// ── Three.js Crystalline Network (hero canvas only) ──
(function () {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const mobile = W() < 768;

  // Logo-inspired color palette
  const COLORS = [
    0x44caa2,  // teal (primary from logo)
    0x63b3ed,  // blue (supporting)
    0x68d391,  // green
    0xc9a84c,  // gold (accent)
    0x2f855a,  // deep green
  ];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W() / H(), 0.1, 2000);
  camera.position.z = 500;

  // ── Starfield background ──
  const starCount = mobile ? 200 : 450;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3]     = (Math.random() - 0.5) * 2400;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 1600;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 800 - 200;
    starSizes[i] = Math.random() * 1.2 + 0.3;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    size: 1.0,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── Crystalline nodes ──
  // Mix of octahedrons (logo's crystalline facets) and small spheres (logo's corner dots)
  const NODE_COUNT = mobile ? 28 : 55;
  const CONNECT_DIST = mobile ? 140 : 165;

  const nodes = [];
  const geoOcta = new THREE.OctahedronGeometry(2.8, 0);        // crystal facets
  const geoSphere = new THREE.SphereGeometry(1.5, 5, 5);       // corner dots
  const geoDiamond = new THREE.TetrahedronGeometry(2.2, 0);     // smaller crystals

  const spreadX = W() * 0.55;
  const spreadY = H() * 0.55;

  for (let i = 0; i < NODE_COUNT; i++) {
    const colorIndex = Math.floor(Math.random() * COLORS.length);
    const color = COLORS[colorIndex];
    const rand = Math.random();

    let geo, opacity, size;
    if (rand < 0.35) {
      // Large crystal (octahedron) — like logo facets
      geo = geoOcta;
      opacity = 0.55 + Math.random() * 0.3;
      size = 0.8 + Math.random() * 0.8;
    } else if (rand < 0.65) {
      // Corner dot (sphere) — like logo node dots
      geo = geoSphere;
      opacity = 0.65 + Math.random() * 0.25;
      size = 0.7 + Math.random() * 0.5;
    } else {
      // Small diamond (tetrahedron)
      geo = geoDiamond;
      opacity = 0.45 + Math.random() * 0.3;
      size = 0.6 + Math.random() * 0.6;
    }

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      wireframe: rand < 0.35 ? true : false, // crystals as wireframe = logo facet lines
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(size);
    mesh.position.set(
      (Math.random() - 0.5) * spreadX * 2,
      (Math.random() - 0.5) * spreadY * 2,
      (Math.random() - 0.5) * 240
    );

    // Rotation rates — crystals slowly rotate
    const rotX = (Math.random() - 0.5) * 0.006;
    const rotY = (Math.random() - 0.5) * 0.008;
    const rotZ = (Math.random() - 0.5) * 0.004;

    scene.add(mesh);
    nodes.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      rotX, rotY, rotZ,
      color,
    });
  }

  // ── Glowing connection lines ──
  // Colors matching the logo's connecting lines (teal/blue-ish)
  const LINE_COLORS = [0x44caa2, 0x63b3ed, 0x68d391];
  const MAX_LINES = mobile ? 40 : 80;
  const lines = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const lColor = LINE_COLORS[i % LINE_COLORS.length];
    const mat = new THREE.LineBasicMaterial({
      color: lColor,
      transparent: true,
      opacity: 0,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()
    ]);
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    scene.add(line);
    lines.push(line);
  }

  // ── Mouse parallax ──
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / W() - 0.5) * 22;
    mouse.ty = -(e.clientY / H() - 0.5) * 22;
  }, { passive: true });

  // ── Resize ──
  window.addEventListener('resize', () => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  });

  // ── Animation loop ──
  let raf;
  let frame = 0;

  function animate() {
    raf = requestAnimationFrame(animate);
    frame++;

    const hw = W() * 0.58;
    const hh = H() * 0.58;

    // Smooth mouse
    mouse.x += (mouse.tx - mouse.x) * 0.03;
    mouse.y += (mouse.ty - mouse.y) * 0.03;
    camera.position.x += (mouse.x - camera.position.x) * 0.025;
    camera.position.y += (mouse.y - camera.position.y) * 0.025;

    // Move and rotate nodes
    nodes.forEach(n => {
      n.mesh.position.x += n.vx;
      n.mesh.position.y += n.vy;
      if (Math.abs(n.mesh.position.x) > hw) n.vx *= -1;
      if (Math.abs(n.mesh.position.y) > hh) n.vy *= -1;

      // Crystal rotation — slow, graceful
      n.mesh.rotation.x += n.rotX;
      n.mesh.rotation.y += n.rotY;
      n.mesh.rotation.z += n.rotZ;
    });

    // Connections — draw lines between nearby nodes
    let li = 0;
    lines.forEach(l => { l.visible = false; });

    for (let i = 0; i < nodes.length && li < MAX_LINES; i++) {
      for (let j = i + 1; j < nodes.length && li < MAX_LINES; j++) {
        const d = nodes[i].mesh.position.distanceTo(nodes[j].mesh.position);
        if (d < CONNECT_DIST) {
          const l = lines[li++];
          const pos = l.geometry.attributes.position;
          pos.setXYZ(0, nodes[i].mesh.position.x, nodes[i].mesh.position.y, nodes[i].mesh.position.z * 0.3);
          pos.setXYZ(1, nodes[j].mesh.position.x, nodes[j].mesh.position.y, nodes[j].mesh.position.z * 0.3);
          pos.needsUpdate = true;
          // Fade by distance — closer nodes have more visible lines
          l.material.opacity = (1 - d / CONNECT_DIST) * 0.28;
          l.visible = true;
        }
      }
    }

    // Gentle starfield pulse
    if (frame % 3 === 0) {
      starMat.opacity = 0.22 + Math.sin(frame * 0.008) * 0.06;
    }

    renderer.render(scene, camera);
  }

  animate();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else animate();
  });
})();
