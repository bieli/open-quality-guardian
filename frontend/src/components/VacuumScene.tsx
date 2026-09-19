import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";

function Body() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.2, 0.28, 48]} />
        <meshStandardMaterial color="#efe8df" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.16, 32]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 24]} />
        <meshStandardMaterial color="#c45e2b" emissive="#c45e2b" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.72, 0.12, 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.12, 20]} />
        <meshStandardMaterial color="#1c1612" />
      </mesh>
      <mesh position={[-0.72, 0.12, 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.12, 20]} />
        <meshStandardMaterial color="#1c1612" />
      </mesh>
      <mesh position={[0, 0.12, -0.7]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#2a2420" />
      </mesh>
      <mesh position={[0.55, 0.34, 0.85]}>
        <boxGeometry args={[0.35, 0.06, 0.08]} />
        <meshStandardMaterial color="#9c1d33" />
      </mesh>
    </group>
  );
}

export function VacuumScene() {
  return (
    <div className="canvas-3d">
      <Canvas camera={{ position: [2.4, 1.8, 2.6], fov: 42 }} shadows>
        <color attach="background" args={["#d7cfc2"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} castShadow />
        <Body />
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={8} blur={2.2} />
        <OrbitControls enablePan={false} minDistance={2.2} maxDistance={5} />
      </Canvas>
    </div>
  );
}
