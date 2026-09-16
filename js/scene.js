(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  const stage = canvas.parentElement;
  let width = stage.clientWidth, height = stage.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  // core: layered icosahedron wireframes (an "aperture" / iris made of geometry)
  const group = new THREE.Group();
  scene.add(group);

  const teal = 0xE62429;
  const violet = 0x2E4BD1;

  const layers = [
    { radius: 2.1, color: teal, detail: 1, opacity: 0.9 },
    { radius: 2.7, color: violet, detail: 0, opacity: 0.35 },
    { radius: 3.3, color: teal, detail: 0, opacity: 0.15 }
  ];

  layers.forEach((l, idx) => {
    const geo = new THREE.IcosahedronGeometry(l.radius, l.detail);
    const mat = new THREE.MeshBasicMaterial({
      color: l.color, wireframe: true, transparent: true, opacity: l.opacity
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.speed = 0.05 + idx * 0.03;
    mesh.userData.axis = idx % 2 === 0 ? 'y' : 'x';
    group.add(mesh);
  });

  // scattered points (scan particles)
  const particleCount = 140;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 4 + Math.random() * 2.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: teal, size: 0.035, transparent: true, opacity: 0.7 });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate() {
    requestAnimationFrame(animate);
    if (!reduceMotion) {
      group.children.forEach(mesh => {
        mesh.rotation[mesh.userData.axis] += mesh.userData.speed * 0.01;
        mesh.rotation.y += 0.0015;
      });
      points.rotation.y += 0.0009;
      group.rotation.y += (mouseX * 0.3 - group.rotation.y) * 0.02;
      group.rotation.x += (mouseY * 0.2 - group.rotation.x) * 0.02;
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    width = stage.clientWidth; height = stage.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
})();
