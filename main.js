// Set up the scene
const scene = new THREE.Scene();

// Set up the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
let cameraPosition = { x: 0, y: 0, z: 500 }; // Default position
camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
camera.lookAt(new THREE.Vector3(0, 0, 0)); // Look at the center of your path

// Set up the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a cube skybox with PNG textures
const textureLoader = new THREE.CubeTextureLoader();
const skyboxTextures = textureLoader.load([
    'assets/px.png', // right
    'assets/nx.png', // left
    'assets/py.png', // top
    'assets/ny.png', // bottom
    'assets/pz.png', // front
    'assets/nz.png'  // back
]);

scene.background = skyboxTextures;

// Create a simplified airplane model using geometries
const airplaneGeometry = new THREE.Group();

// Create the body
const bodyGeometry = new THREE.CylinderGeometry(15, 15, 100, 32);
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.rotation.x = Math.PI / 2;
airplaneGeometry.add(body);

// Create the wings
const wingGeometry = new THREE.BoxGeometry(80, 10, 20);
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const wing1 = new THREE.Mesh(wingGeometry, wingMaterial);
wing1.position.set(0, 30, 0);
wing1.rotation.z = Math.PI / 2;
const wing2 = wing1.clone();
wing2.position.set(0, -30, 0);
wing2.rotation.z = Math.PI / 2;
airplaneGeometry.add(wing1);
airplaneGeometry.add(wing2);

// Rotate the entire airplaneGeometry 90 degrees to the right
airplaneGeometry.rotation.z = -Math.PI / 2;

airplaneGeometry.scale.set(0.5, 0.5, 0.5);
scene.add(airplaneGeometry);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Add directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5).normalize();
scene.add(directionalLight);

// Variables for animation
let logData = [];
let logIndex = 0;
let transitionStartTime = 0;

// Line geometry to visualize the path
const pathPoints = [];
const pathGeometry = new THREE.BufferGeometry();
const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
const pathLine = new THREE.Line(pathGeometry, pathMaterial);
scene.add(pathLine);

// Function to start animation
function startAnimation(data) {
    logData = data;
    logIndex = 0;
    transitionStartTime = Date.now();

    // Clear previous points if any
    pathPoints.length = 0;

    // Add path points with scaling
    data.forEach(entry => {
        if (!isNaN(entry.x) && !isNaN(entry.y) && !isNaN(entry.altitude)) {
            pathPoints.push(new THREE.Vector3(entry.x, entry.y, entry.altitude));
        }
    });

    if (pathPoints.length > 0) {
        pathGeometry.setFromPoints(pathPoints);
        airplaneGeometry.position.copy(pathPoints[0]);  // Set initial position

        // Adjust camera position based on data bounds
        const xMin = Math.min(...pathPoints.map(p => p.x));
        const xMax = Math.max(...pathPoints.map(p => p.x));
        const yMin = Math.min(...pathPoints.map(p => p.y));
        const yMax = Math.max(...pathPoints.map(p => p.y));
        const zMin = Math.min(...pathPoints.map(p => p.z));
        const zMax = Math.max(...pathPoints.map(p => p.z));

        const centerX = (xMax + xMin) / 2;
        const centerY = (yMax + yMin) / 2;
        const centerZ = (zMax + zMin) / 2;

        // Set camera position based on bounds
        cameraPosition = {
            x: centerX + 100,  // Adjust the offset as needed
            y: centerY,
            z: centerZ + 100
        };

        camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
        camera.lookAt(new THREE.Vector3(centerX, centerY, centerZ));
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

fetchCSV('assets/logfile.csv', (results) => {
    // Convert CSV data to the required format
    const data = results.data.map(row => ({
        time: parseInt(row.time, 10),
        x: parseFloat(row.x),
        y: parseFloat(row.y),
        altitude: parseFloat(row.altitude)
    }));
    console.log('Parsed Data:', data); // Debugging: Check parsed data
    startAnimation(data);
});

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
                // Interpolate position smoothly
                const currentPosition = new THREE.Vector3(currentLogEntry.x, currentLogEntry.y, currentLogEntry.altitude);
                const targetPosition = new THREE.Vector3(nextLogEntry.x, nextLogEntry.y, nextLogEntry.altitude);
                airplaneGeometry.position.lerpVectors(currentPosition, targetPosition, progress);
            } else {
                // When transition completes, move to next point
                airplaneGeometry.position.set(nextLogEntry.x, nextLogEntry.y, nextLogEntry.altitude);
                logIndex++;
                transitionStartTime = Date.now();

                // Stop animation when all data points are processed
                if (logIndex >= logData.length) {
                    logIndex = logData.length - 1;
                }
            }
        }
    }

    // Ensure no unnecessary rotations
    airplaneGeometry.rotation.set(0, 0, -Math.PI / 2);

    // Render the scene
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