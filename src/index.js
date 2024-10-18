import * as THREE from "three";
import * as dat from 'dat.gui';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { gsap } from "gsap";

// Core boilerplate code deps
import { createCamera, getDefaultUniforms, createRenderer, runApp } from "./core-utils";
import vertexShader from './shaders/vertexShader.glsl';
import fragmentShader from './shaders/fragmentShader.glsl';

global.THREE = THREE;
THREE.ColorManagement.enabled = true;

/**************************************************
* Tweakable parameters
*************************************************/
const uniforms = {
  ...getDefaultUniforms(),
  u_bFactor: { value: 0.1 },
  u_pcurveHandle: { value: 11 },
  u_mousePosition: { value: new THREE.Vector2(1, 1) } 
};

const numBubbles = 200; // number of bubbles
const bubbles = [];
let radius = 3; // radius of water sphere
const waterArea = radius * 2; // bubble area
const bubbleSpeed = 3 // higher is slower
let bubblesPopped = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let INTERSECTED = [];
let workLight = 0; // ambientLight intensity
let workLightInterval = null;  // interval to fade workLight back to 0

/**************************************************
 * Initialize components
 *************************************************/
// Create the scene
let scene = new THREE.Scene();
scene.background = new THREE.Color("white");

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  _renderer.outputEncoding = THREE.sRGBEncoding;
});

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 1000, { x: 0, y: 0, z: radius});

// create an AudioListener and add it to the camera
const listener = new THREE.AudioListener();
camera.add(listener);

// load sound file
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('/bubble.mp3', (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(false);  // Play once
    sound.setVolume(1);
    console.log("sound ok");
});

// globalize ambient light so that workLight variable can affect intensity
const ambientLight = new THREE.AmbientLight("white", workLight);
scene.add(ambientLight);

// globalize bubble group (bubbleGroup) so that raycaster animation loop can confirm object is within bubbleGroup
const bubbleGroup = new THREE.Group();
scene.add(bubbleGroup); 

// Bubble class
class Bubble {
  constructor(scene) {
      this.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("lightblue"),
          transparent: true,
          opacity: 0.5,
          metalness: 0.5,
          roughness: 0.1,
          side: THREE.BackSide,
          depthWrite: false
      });

      this.radius = Math.random() * 0.1 + 0.05; 
      this.geometry = new THREE.SphereGeometry(this.radius, 32, 32);
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.position.set(
        Math.random() * waterArea - waterArea / 2,
        Math.random() * waterArea - waterArea / 2,
        Math.random() * waterArea - waterArea / 2 
        );      
      scene.add(this.mesh);
      this.animateBubble();
  }

  animateBubble() {
    const duration = (waterArea/2 - this.mesh.position.y) * bubbleSpeed;

    gsap.to(this.mesh.position, {
      y: waterArea / 2,
      duration: duration,
      ease: 'none', 
      onComplete: () => {
          this.mesh.position.y = -waterArea / 2; 
          this.animateBubble(); 
      }
    });
  }
}

const onClick = () => {
  if (!INTERSECTED) return;
  if (INTERSECTED) {
    sound.play(); 
    popBubble();

    // brighten and then slowly dim ambient light
    workLight = 1;
    if (workLightInterval) {
      clearInterval(workLightInterval);
    }

    workLightInterval = setInterval(() => {
      if (workLight > 0) {
        workLight = Math.max(workLight - 0.01, 0);
      } else {
        clearInterval(workLightInterval); 
        // reset bubbles popped
        bubblesPopped = 0;
        updateCounter();
      }
    }, 50);

    gsap.to(INTERSECTED.scale, {
      x: INTERSECTED.scale.x * waterArea, 
      y: INTERSECTED.scale.y * waterArea,
      z: INTERSECTED.scale.z * waterArea,
      duration: 0.5,
      ease: "power1.in",
    });
    
    gsap.set(INTERSECTED.position, {
      y: -radius,  
      overwrite: true,
      delay: 0.5,
    });

    gsap.set(INTERSECTED.scale, {
      x: 1, 
      y: 1,
      z: 1,
      delay: 0.5,
    });

    gsap.to(INTERSECTED.position, {
      y: waterArea / 2,
      duration: waterArea * bubbleSpeed,
      ease: 'none', 
      delay: 0.5,
      onComplete: () => {
        y = -waterArea / 2; 
      },
      repeat: -1
    });

  };
};

function updateCounter() {
  const counterElement = document.getElementById("counter");
  if (bubblesPopped > 0) {
    counterElement.style.display = "block"; 
    counterElement.innerHTML = `Bubbles Popped: ${bubblesPopped}`;
  } else {
    // hide counter when factory setting is dark
    counterElement.style.display = "none"; 
  }
}

function popBubble() {
  bubblesPopped += 1;
  updateCounter(); 
}

/**************************************************
 * Build scene 
 *************************************************/
let app = {
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.4;
    // this.controls.enableZoom = false;

    // Water surface (Sphere with Voronoi texture)
    const sphereGeometry = new THREE.SphereGeometry(radius, 64, 64);
    const sphereMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      opacity: .7
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    // Factory setting (video Sphere, 360 video on inside of material)
    // lighting is affected by ambient light (workLight variable = intensity)
    const videoElement1 = document.getElementById("video-texture-1");
    videoElement1.play();
    const videoTexture1 = new THREE.VideoTexture(videoElement1);
    videoTexture1.colorSpace = THREE.SRGBColorSpace;
    const videoMaterial1 = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: videoTexture1,
      side: THREE.BackSide,
      flatShading: true
    });

    const sphereGeometry2 = new THREE.SphereGeometry(radius * 10, 128, 128);
    const factory = new THREE.Mesh(sphereGeometry2, videoMaterial1);
    scene.add(factory);

    // Bubbles!!! create based on numBubbles
    for (let i = 0; i < numBubbles; i++) {
        const bubble = new Bubble(bubbleGroup);
        bubbles.push(bubble);
    }
    
    // raycaster
    const onPointerMove = (event) => {
      // calculate pointer position in normalized device coordinates
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    // event listeners
    window.addEventListener('mousemove', (event) => {
      const mouseX = event.clientX / window.innerWidth;
      const mouseY = 1 - event.clientY / window.innerHeight;  // Invert Y-axis
      uniforms.u_mousePosition.value.set(mouseX, mouseY);
    });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("click", onClick);

    // lighting
    const pointLight = new THREE.PointLight("white", 2, 10);
    pointLight.position.set(-radius, -radius, 0);

    const rectLight = new THREE.RectAreaLight("white", 3, waterArea, waterArea);
    rectLight.position.set(radius, 0, 0);
    rectLight.lookAt(0, 0, 0);

    const rectLight2 = new THREE.RectAreaLight("white", 3, waterArea, waterArea);
    rectLight2.position.set(-radius, 0, 0);
    rectLight2.lookAt(0, 0, 0);

    scene.add(pointLight, rectLight, rectLight2);
  },

// called every frame, use for animation
  updateScene(interval, elapsed) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    INTERSECTED = null;

    for (const intersect of intersects) {
        // Check if the intersected object is part of bubbleGroup
        if (bubbleGroup.children.includes(intersect.object)) {
            INTERSECTED = intersect.object; 
            break;
        }
    }
    this.controls.update();
    ambientLight.intensity = workLight;
  },
};

/**************************************************
 * Run the app
 *************************************************/
runApp(app, scene, renderer, camera, true, uniforms, undefined);
