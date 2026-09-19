import { Color, ShaderChunk, ShaderLib, UniformsUtils } from 'three';

// three.js r160 official example shader, vendored so the preview has no CDN dependency.
function replaceAll(string, find, replace) { return string.split(find).join(replace); }
const fragHead = ShaderChunk.meshphong_frag.slice(0, ShaderChunk.meshphong_frag.indexOf('void main() {'));
const fragBody = ShaderChunk.meshphong_frag.slice(ShaderChunk.meshphong_frag.indexOf('void main() {'));

const SubsurfaceScatteringShader = {
  name: 'SubsurfaceScatteringShader',
  uniforms: UniformsUtils.merge([
    ShaderLib.phong.uniforms,
    {
      thicknessMap: { value: null },
      detailMap: { value: null },
      thicknessColor: { value: new Color(0xffffff) },
      thicknessDistortion: { value: 0.1 },
      thicknessAmbient: { value: 0.0 },
      thicknessAttenuation: { value: 0.1 },
      thicknessPower: { value: 2.0 },
      thicknessScale: { value: 10.0 },
    },
  ]),
  vertexShader: ['#define USE_UV', ShaderChunk.meshphong_vert].join('\n'),
  fragmentShader: [
    '#define USE_UV', '#define SUBSURFACE', fragHead,
    'uniform sampler2D thicknessMap;',
    'uniform sampler2D detailMap;',
    'uniform float thicknessPower;',
    'uniform float thicknessScale;',
    'uniform float thicknessDistortion;',
    'uniform float thicknessAmbient;',
    'uniform float thicknessAttenuation;',
    'uniform vec3 thicknessColor;',
    'void RE_Direct_Scattering(const in IncidentLight directLight, const in vec2 uv, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, inout ReflectedLight reflectedLight) {',
    ' vec3 thickness = thicknessColor * texture2D(thicknessMap, uv).r;',
    ' vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));',
    ' float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;',
    ' vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * thickness;',
    ' reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;',
    '}',
    fragBody.replace('#include <map_fragment>', 'diffuseColor *= texture2D(detailMap, vUv);').replace('#include <lights_fragment_begin>', replaceAll(
      ShaderChunk.lights_fragment_begin,
      'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
      [
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        '#if defined( SUBSURFACE ) && defined( USE_UV )',
        'RE_Direct_Scattering(directLight, vUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);',
        '#endif',
      ].join('\n')
    )),
  ].join('\n'),
};
export { SubsurfaceScatteringShader };
