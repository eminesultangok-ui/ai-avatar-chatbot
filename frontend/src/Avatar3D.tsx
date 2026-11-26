import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
    VRMLoaderPlugin,
    VRMUtils,
    type VRM,
} from '@pixiv/three-vrm'

type AvatarModelProps = {
    isSpeaking: boolean
}

function AvatarModel({ isSpeaking }: AvatarModelProps) {
    const [vrm, setVrm] = useState<VRM | null>(null)
    const modelRef = useRef<THREE.Group>(null)

    useEffect(() => {
        const loader = new GLTFLoader()

        loader.register((parser) => {
            return new VRMLoaderPlugin(parser)
        })

        loader.load(
            '/ava-female.vrm',
            (gltf) => {
                const loadedVrm = gltf.userData.vrm as VRM

                VRMUtils.removeUnnecessaryVertices(gltf.scene)

                const box = new THREE.Box3().setFromObject(
                    loadedVrm.scene
                )

                const size = new THREE.Vector3()
                const center = new THREE.Vector3()

                box.getSize(size)
                box.getCenter(center)

                const scale = 3.0 / size.y

                loadedVrm.scene.rotation.y = Math.PI
                loadedVrm.scene.scale.setScalar(scale)

                loadedVrm.scene.position.set(
                    -center.x * scale,
                    -center.y * scale - 0.95,
                    -center.z * scale
                )

                console.log('Ava 3D model loaded successfully')
                setVrm(loadedVrm)
            },
            undefined,
            (error) => {
                console.error(
                    'Ava 3D model could not be loaded:',
                    error
                )
            }
        )
    }, [])

    useFrame((state, delta) => {
        if (!vrm) return

        vrm.update(delta)

        const time = state.clock.getElapsedTime()

        if (modelRef.current) {
            modelRef.current.position.y =
                Math.sin(time * 1.2) * 0.012
        }

        // Kolları aşağı indir
        const leftUpperArm =
            vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')

        const rightUpperArm =
            vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')

        const leftLowerArm =
            vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')

        const rightLowerArm =
            vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')

        if (leftUpperArm) {
            leftUpperArm.rotation.z =
                1.15 + Math.sin(time * 1.1) * 0.015
            leftUpperArm.rotation.x = 0.05
        }

        if (rightUpperArm) {
            rightUpperArm.rotation.z =
                -1.15 - Math.sin(time * 1.1) * 0.015
            rightUpperArm.rotation.x = 0.05
        }

        if (leftLowerArm) {
            leftLowerArm.rotation.z = 0.08
        }

        if (rightLowerArm) {
            rightLowerArm.rotation.z = -0.08
        }

        // Hafif baş hareketi
        const head =
            vrm.humanoid?.getNormalizedBoneNode('head')

        if (head) {
            head.rotation.y = Math.sin(time * 0.6) * 0.035
            head.rotation.x = Math.sin(time * 0.45) * 0.018
        }

        if (vrm.expressionManager) {
            // Göz kırpma
            const blinkCycle = time % 4

            const blink =
                blinkCycle > 3.8
                    ? Math.sin(
                        ((blinkCycle - 3.8) / 0.2) * Math.PI
                    )
                    : 0

            vrm.expressionManager.setValue('blink', blink)

            // Kaş hareketi
            const browMovement = isSpeaking
                ? Math.abs(Math.sin(time * 2.2)) * 0.25
                : Math.abs(Math.sin(time * 0.8)) * 0.08

            vrm.expressionManager.setValue(
                'browInnerUp',
                browMovement
            )

            vrm.expressionManager.setValue(
                'browOuterUpLeft',
                browMovement * 0.6
            )

            vrm.expressionManager.setValue(
                'browOuterUpRight',
                browMovement * 0.6
            )

            // Konuşurken ağız hareketi
            if (isSpeaking) {
                vrm.expressionManager.setValue(
                    'aa',
                    0.25 + Math.abs(Math.sin(time * 10)) * 0.55
                )

                vrm.expressionManager.setValue(
                    'ih',
                    Math.abs(Math.sin(time * 7)) * 0.3
                )
            } else {
                vrm.expressionManager.setValue('aa', 0)
                vrm.expressionManager.setValue('ih', 0)
            }
        }
    })

    if (!vrm) {
        return null
    }

    return (
        <group ref={modelRef}>
            <primitive object={vrm.scene} />
        </group>
    )
}

type Avatar3DProps = {
    isSpeaking: boolean
}

export default function Avatar3D({
    isSpeaking,
}: Avatar3DProps) {
    return (
        <div className="avatar-3d-container">
            <Canvas
                camera={{
                    position: [0, 0.05, 2.25],
                    fov: 28,
                }}
            >
                <color
                    attach="background"
                    args={['#eaf2fb']}
                />

                <ambientLight intensity={2} />

                <directionalLight
                    position={[2, 4, 5]}
                    intensity={3}
                />

                <directionalLight
                    position={[-3, 2, 3]}
                    intensity={1.2}
                    color="#9ecbff"
                />

                <AvatarModel isSpeaking={isSpeaking} />

                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    enableRotate={false}
                />
            </Canvas>
        </div>
    )
}