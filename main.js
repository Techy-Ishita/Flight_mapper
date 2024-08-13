import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Set up the scene
const scene = new THREE.Scene();

// Set up the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const cameraDistance = 200; // Distance from the airplane

// Set up the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create and configure OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.3; // Adjust to make damping smoother
controls.enableZoom = true;
controls.enablePan = true;
controls.enableRotate = true;
controls.maxPolarAngle = Math.PI; // Allow full vertical rotation
controls.minPolarAngle = 0;       // Prevent flipping over
controls.maxAzimuthAngle = Infinity; // Allow full horizontal rotation
controls.minAzimuthAngle = -Infinity; // Allow full horizontal rotation
// controls.mouseButtons = {
//     LEFT: THREE.MOUSE.ROTATE,
//     MIDDLE: THREE.MOUSE.DOLLY,
//     RIGHT: THREE.MOUSE.PAN
// };

// Create a cube skybox with PNG textures
const textureLoader = new THREE.CubeTextureLoader();
const skyboxTextures = textureLoader.load([
    'assets/px.png',
    'assets/nx.png',
    'assets/py.png',
    'assets/ny.png',
    'assets/pz.png',
    'assets/nz.png'
]);
scene.background = skyboxTextures;

// Create a simplified airplane model using geometries
const airplaneGeometry = new THREE.Group();

// Create the body of the airplane
const bodyGeometry = new THREE.CylinderGeometry(15, 15, 100, 32);
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.rotation.y = Math.PI / 2;
airplaneGeometry.add(body);

// Create the wings of the airplane
const wingGeometry = new THREE.BoxGeometry(80, 10, 20);
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const wing1 = new THREE.Mesh(wingGeometry, wingMaterial);
wing1.position.set(0, 30, 0);
wing1.rotation.y = Math.PI / 8;
const wing2 = wing1.clone();
wing2.position.set(0, -30, 0);
wing2.rotation.y = Math.PI / 8;
airplaneGeometry.add(wing1);
airplaneGeometry.add(wing2);

// Create the cone for the airplane nose
const coneGeometry = new THREE.ConeGeometry(20, 50, 32);
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const cone = new THREE.Mesh(coneGeometry, coneMaterial);
cone.position.set(0, 70, 0);
cone.rotation.y = Math.PI;

airplaneGeometry.add(cone);

// Rotate the entire airplaneGeometry 90 degrees to the right
airplaneGeometry.rotation.z = Math.PI / 2;

// Scale the airplane model
airplaneGeometry.scale.set(0.6, 0.6, 0.6);
scene.add(airplaneGeometry);

// Add ambient light to the scene
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Add directional light to the scene
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5).normalize();
scene.add(directionalLight);

// Set initial camera position and controls target
camera.position.set(
    airplaneGeometry.position.x + cameraDistance,
    airplaneGeometry.position.y + cameraDistance,
    airplaneGeometry.position.z + cameraDistance
);
controls.target.copy(airplaneGeometry.position);

// Variables for animation
let logData = [];
let logIndex = 0;
let transitionStartTime = 0;

// Line geometry to visualize the path
const pathPoints = [];
const pathGeometry = new THREE.BufferGeometry();
const pathMaterial = new THREE.LineBasicMaterial({ color: '#0A4672' });
const pathLine = new THREE.Line(pathGeometry, pathMaterial);
scene.add(pathLine);

// Function to start animation
function startAnimation(data) {
    logData = data;
    logIndex = 0;
    transitionStartTime = Date.now();

    pathPoints.length = 0;

    data.forEach(entry => {
        if (!isNaN(entry.x) && !isNaN(entry.y) && !isNaN(entry.altitude)) {
            pathPoints.push(new THREE.Vector3(entry.x, entry.y, entry.altitude));
        }
    });

    if (pathPoints.length > 0) {
        pathGeometry.setFromPoints(pathPoints);
        airplaneGeometry.position.copy(pathPoints[0]);

        // Update camera position and controls target
        camera.position.set(
            airplaneGeometry.position.x + cameraDistance,
            airplaneGeometry.position.y + cameraDistance,
            airplaneGeometry.position.z + cameraDistance
        );
        controls.target.copy(airplaneGeometry.position);
    } else {
        console.warn('No valid path points to visualize.');
    }

    animate();
}

// Fetch and parse the CSV file
function fetchCSV(url, callback) {
    fetch(url)
        .then(response => response.text())
        .then(text => Papa.parse(text, {
            header: true,
            complete: results => callback(results),
            error: error => console.error('Error parsing CSV:', error)
        }))
        .catch(error => console.error('Error fetching CSV file:', error));
}

// Fetch the log file and start animation
fetchCSV('assets/logfile.csv', (results) => {
    const data = results.data.map(row => ({
        time: parseInt(row.time, 10),
        x: parseFloat(row.x),
        y: parseFloat(row.y),
        altitude: parseFloat(row.altitude)
    }));
    console.log('Parsed Data:', data);
    startAnimation(data);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (logData.length > 0 && logIndex < logData.length) {
        const currentTime = Date.now() - transitionStartTime;
        const currentLogEntry = logData[logIndex];
        const nextLogEntry = logIndex + 1 < logData.length ? logData[logIndex + 1] : null;

        if (nextLogEntry) {
            const timeElapsed = currentTime;
            const transitionTime = nextLogEntry.time - currentLogEntry.time;
            const progress = Math.min(timeElapsed / transitionTime, 1);

            if (progress < 1) {
                const currentPosition = new THREE.Vector3(currentLogEntry.x, currentLogEntry.y, currentLogEntry.altitude);
                const targetPosition = new THREE.Vector3(nextLogEntry.x, nextLogEntry.y, nextLogEntry.altitude);
                airplaneGeometry.position.lerpVectors(currentPosition, targetPosition, progress);

                // Calculate direction and update rotation
                const direction = new THREE.Vector3().subVectors(targetPosition, currentPosition).normalize();
                const up = new THREE.Vector3(0, 1, 0);
                const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
                airplaneGeometry.rotation.setFromQuaternion(quaternion);
            } else {
                airplaneGeometry.position.set(nextLogEntry.x, nextLogEntry.y, nextLogEntry.altitude);
                logIndex++;
                transitionStartTime = Date.now();

                if (logIndex >= logData.length) {
                    logIndex = logData.length - 1;
                }
            }
        }
    }

    // Smooth camera follow with updated target
    if (logData.length > 0 && logIndex < logData.length) {
        if (!controls.isLocked) {
            const offset = new THREE.Vector3(cameraDistance, cameraDistance, cameraDistance);
            const cameraPosition = airplaneGeometry.position.clone().add(offset);
            camera.position.copy(cameraPosition);
            controls.target.copy(airplaneGeometry.position);
        }
    }

    controls.update(); // Update controls

    renderer.render(scene, camera);
}

// Call animate function once to start the animation loop
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
