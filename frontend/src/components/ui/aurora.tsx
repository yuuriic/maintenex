

import { useEffect, useRef } from 'react'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import './aurora.css'

const VERT = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`

const FRAG = `#version 300 es
precision highp float;
uniform float uTime; uniform float uAmplitude; uniform vec3 uColorStops[3]; uniform vec2 uResolution; uniform float uBlend;
out vec4 fragColor;
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx); vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod(i,289.);
  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
  vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-.5; vec3 ox=floor(x+.5); vec3 a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.*dot(m,g);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uResolution;
  vec3 ramp=uv.x<.5?mix(uColorStops[0],uColorStops[1],uv.x*2.):mix(uColorStops[1],uColorStops[2],(uv.x-.5)*2.);
  float height=snoise(vec2(uv.x*2.+uTime*.1,uTime*.25))*.5*uAmplitude;
  height=exp(height); height=uv.y*2.-height+.2; float intensity=.6*height;
  float alpha=smoothstep(.20-uBlend*.5,.20+uBlend*.5,intensity);
  fragColor=vec4(intensity*ramp*alpha,alpha);
}`

type AuroraProps = {
  colorStops?: [string, string, string]
  speed?: number
  blend?: number
  amplitude?: number
}

export default function Aurora({ colorStops = ['#8fd94b', '#cabdf5', '#5b7c8c'], speed = .65, blend = .72, amplitude = .85 }: AuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef({ colorStops, speed, blend, amplitude })
  propsRef.current = { colorStops, speed, blend, amplitude }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) delete geometry.attributes.uv
    const colors = () => propsRef.current.colorStops.map(hex => { const c = new Color(hex); return [c.r, c.g, c.b] })
    const program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms: {
      uTime: { value: 0 }, uAmplitude: { value: amplitude }, uColorStops: { value: colors() },
      uResolution: { value: [container.offsetWidth, container.offsetHeight] }, uBlend: { value: blend },
    } })
    const mesh = new Mesh(gl, { geometry, program })
    container.appendChild(gl.canvas)
    const resize = () => { renderer.setSize(container.offsetWidth, container.offsetHeight); program.uniforms.uResolution.value = [container.offsetWidth, container.offsetHeight] }
    window.addEventListener('resize', resize)
    resize()
    let frame = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const update = (time: number) => {
      program.uniforms.uTime.value = time * .001 * propsRef.current.speed
      program.uniforms.uAmplitude.value = propsRef.current.amplitude
      program.uniforms.uBlend.value = propsRef.current.blend
      program.uniforms.uColorStops.value = colors()
      renderer.render({ scene: mesh })
      if (!reduceMotion) frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('resize', resize)
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <div ref={containerRef} className="aurora-container" aria-hidden="true" />
}
