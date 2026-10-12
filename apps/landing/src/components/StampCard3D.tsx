import { useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Float, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { STAMP_GOAL } from '../lib/stamps'

const TERRACOTA = '#c2410c'
const NOCHE = '#1c1917'
const CREMA = '#fff7ed'
const MOSTAZA = '#facc15'

/** Frente de la tarjeta dibujado en un canvas 2D (sin cargar fuentes desde la red 3D). */
function useCardFace(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1360
    canvas.height = 840
    const ctx = canvas.getContext('2d')
    const draw = () => {
      if (!ctx) return
      ctx.fillStyle = CREMA
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = TERRACOTA
      ctx.fillRect(0, 0, canvas.width, 190)
      ctx.fillStyle = CREMA
      ctx.font = '700 84px "Bricolage Grotesque", system-ui, sans-serif'
      ctx.fillText('Café del Barrio', 70, 125)
      ctx.font = 'italic 54px "Instrument Serif", Georgia, serif'
      ctx.textAlign = 'right'
      ctx.fillText('club', canvas.width - 70, 120)
      ctx.textAlign = 'left'
      ctx.fillStyle = NOCHE
      ctx.font = '500 48px "Bricolage Grotesque", system-ui, sans-serif'
      ctx.fillText('8 cafés y el 9.º va de regalo', 70, 770)
      ctx.fillStyle = '#57534e'
      ctx.font = '400 38px "Bricolage Grotesque", system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('Hola, Ana', canvas.width - 70, 770)
    }
    draw()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    // Cuando terminan de cargar las fuentes de Google, se vuelve a dibujar.
    void document.fonts?.ready.then(() => {
      draw()
      texture.needsUpdate = true
    })
    return texture
  }, [])
}

function slotPosition(index: number): [number, number, number] {
  const col = index % 5
  const row = Math.floor(index / 5)
  const offset = row === 1 ? 0.33 : 0
  return [-1.32 + col * 0.66 + offset, 0.2 - row * 0.62, 0.05]
}

function Stamp({ index, filled }: { index: number; filled: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const [x, y, z] = slotPosition(index)
  const isPrize = index === STAMP_GOAL - 1

  useFrame((_, delta) => {
    const group = ref.current
    if (!group) return
    const target = filled ? 1 : 0.001
    group.scale.x = THREE.MathUtils.damp(group.scale.x, target, 14, delta)
    group.scale.y = group.scale.x
    group.scale.z = group.scale.x
    group.position.z = THREE.MathUtils.damp(
      group.position.z,
      filled ? z + 0.02 : z + 0.4,
      10,
      delta,
    )
  })

  return (
    <group position={[x, y, z]}>
      {/* Casillero vacío: un aro. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.012, 8, 48]} />
        <meshStandardMaterial color={isPrize ? TERRACOTA : '#a8a29e'} />
      </mesh>
      <group ref={ref} scale={0.001}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.05, 40]} />
          <meshStandardMaterial
            color={isPrize ? MOSTAZA : TERRACOTA}
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>
        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.018, 8, 32]} />
          <meshStandardMaterial color={CREMA} />
        </mesh>
      </group>
    </group>
  )
}

function Card({ stamps, onStamp }: { stamps: number; onStamp: () => void }) {
  const group = useRef<THREE.Group>(null)
  const face = useCardFace()

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, state.pointer.x * 0.45, 4, delta)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.3, 4, delta)
  })

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    onStamp()
  }

  return (
    <group ref={group}>
      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.6}>
        <group
          onClick={handleClick}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <RoundedBox args={[3.4, 2.1, 0.08]} radius={0.09} smoothness={6}>
            <meshStandardMaterial color={CREMA} roughness={0.7} />
          </RoundedBox>
          <mesh position={[0, 0, 0.041]}>
            <planeGeometry args={[3.26, 2.0]} />
            <meshStandardMaterial map={face} roughness={0.65} />
          </mesh>
          {Array.from({ length: STAMP_GOAL }, (_, i) => (
            <Stamp key={i} index={i} filled={i < stamps} />
          ))}
        </group>
      </Float>
    </group>
  )
}

/** Granos de café y monedas flotando alrededor. */
function Orbiters() {
  const group = useRef<THREE.Group>(null)
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        radius: 2.6 + (i % 3) * 0.45,
        y: ((i * 37) % 10) / 10 - 0.5,
        coin: i % 4 === 0,
        speed: 0.6 + (i % 5) * 0.12,
      })),
    [],
  )

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.rotation.y = state.clock.elapsedTime * 0.08
    g.children.forEach((child, i) => {
      const item = items[i]
      if (!item) return
      child.rotation.x = state.clock.elapsedTime * item.speed
      child.rotation.z = state.clock.elapsedTime * item.speed * 0.7
    })
  })

  return (
    <group ref={group} position={[0, 0, -1]}>
      {items.map((item, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(item.angle) * item.radius,
            item.y * 2,
            Math.sin(item.angle) * item.radius,
          ]}
          scale={item.coin ? 1 : [0.16, 0.11, 0.09]}
        >
          {item.coin ? (
            <cylinderGeometry args={[0.16, 0.16, 0.04, 32]} />
          ) : (
            <sphereGeometry args={[1, 20, 14]} />
          )}
          <meshStandardMaterial
            color={item.coin ? MOSTAZA : '#5b3a29'}
            metalness={item.coin ? 0.7 : 0}
            roughness={item.coin ? 0.3 : 0.6}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function StampCard3D({ stamps, onStamp }: { stamps: number; onStamp: () => void }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      aria-label="Tarjeta de sellos en 3D: tocala para sumar sellos"
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <directionalLight position={[-4, -2, 2]} intensity={0.4} color={TERRACOTA} />
      <Card stamps={stamps} onStamp={onStamp} />
      <Orbiters />
      <ContactShadows position={[0, -1.7, 0]} opacity={0.28} scale={9} blur={2.6} far={3} />
    </Canvas>
  )
}
