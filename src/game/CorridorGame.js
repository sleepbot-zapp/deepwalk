import * as THREE from 'three';

const CORRIDOR_WIDTH = 4;
const CORRIDOR_LENGTH = 400;
const WALL_H = 3;
const MOVE_SPEED = 5.5;
const RUN_MULT = 2.0;

function makeStripeTexture(color, length) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 512);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 512; i += 64) {
    ctx.fillRect(0, i, 128, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, length / 8);
  return tex;
}

/**
 * CorridorGame — a minimal FPS movement/look test.
 *
 * Mouse look and WASD movement are intentionally independent, the way a
 * normal FPS works:
 *  - moving the mouse only changes `yaw`/`pitch` (which way the camera faces)
 *  - WASD moves the player relative to the CURRENT facing direction (yaw),
 *    it never touches yaw/pitch itself
 *
 * Framework-agnostic, same pattern as MazeGame: React just mounts it into a
 * div and reads state back out via callbacks.
 */
export class CorridorGame {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.keys = {};
    this.yaw = Math.PI;
    this.pitch = 0;
    this.player = { x: 0, z: 0 };
    this.currentSpeed = 0;
    this.collideHalfWidth = CORRIDOR_WIDTH / 2 - 0.4;

    this._initThree();
    this._buildCorridor();
    this._bindInput();

    this._animate = this._animate.bind(this);
    this.clock = new THREE.Clock();
    this._raf = requestAnimationFrame(this._animate);
  }

  _initThree() {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x111318, 5, 60);
    this.scene.background = new THREE.Color(0x0d0e12);

    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x8899aa, 0x111111, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 2);
    dir.castShadow = true;
    this.scene.add(dir);

    this._onResize = () => {
      const { clientWidth, clientHeight } = this.container;
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  _buildCorridor() {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 0.9 });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR_WIDTH, CORRIDOR_LENGTH),
      floorMat,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -CORRIDOR_LENGTH / 2 + 5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const leftMat = new THREE.MeshStandardMaterial({
      map: makeStripeTexture('#b25b3a', CORRIDOR_LENGTH),
      roughness: 0.85,
    });
    const rightMat = new THREE.MeshStandardMaterial({
      map: makeStripeTexture('#3a6b8a', CORRIDOR_LENGTH),
      roughness: 0.85,
    });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_LENGTH, WALL_H), leftMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-CORRIDOR_WIDTH / 2, WALL_H / 2, -CORRIDOR_LENGTH / 2 + 5);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_LENGTH, WALL_H), rightMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(CORRIDOR_WIDTH / 2, WALL_H / 2, -CORRIDOR_LENGTH / 2 + 5);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const pillarGeo = new THREE.BoxGeometry(0.3, WALL_H, 0.3);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    for (let z = 5; z > -CORRIDOR_LENGTH + 5; z -= 6) {
      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(-CORRIDOR_WIDTH / 2 + 0.15, WALL_H / 2, z);
      pL.castShadow = true;
      this.scene.add(pL);

      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(CORRIDOR_WIDTH / 2 - 0.15, WALL_H / 2, z);
      pR.castShadow = true;
      this.scene.add(pR);
    }
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      this.keys[e.code] = true;
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };

    this._onMouseMove = (e) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
  }

  requestPointerLock() {
    this.renderer.domElement.requestPointerLock();
  }

  _updateMovement(dt) {
    let mx = 0,
      mz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

    this.currentSpeed = 0;
    if (mx === 0 && mz === 0) return;

    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;

    const running = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const speed = MOVE_SPEED * (running ? RUN_MULT : 1);
    this.currentSpeed = speed;
    const step = speed * dt;

    const sinY = Math.sin(this.yaw),
      cosY = Math.cos(this.yaw);
    const forwardX = -sinY,
      forwardZ = -cosY;
    const rightX = cosY,
      rightZ = -sinY;

    const dx = (forwardX * -mz + rightX * mx) * step;
    const dz = (forwardZ * -mz + rightZ * mx) * step;

    let nx = this.player.x + dx;
    let nz = this.player.z + dz;

    nx = Math.max(-this.collideHalfWidth, Math.min(this.collideHalfWidth, nx));
    nz = Math.max(-CORRIDOR_LENGTH + 6, Math.min(6, nz));

    this.player.x = nx;
    this.player.z = nz;
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this._updateMovement(dt);

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    this.camera.position.set(this.player.x, 1.6, this.player.z);

    if (this.callbacks.onStats) {
      this.callbacks.onStats({ x: this.player.x, z: this.player.z, speed: this.currentSpeed });
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}