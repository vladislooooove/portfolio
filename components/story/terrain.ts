/**
 * The ground the prologue opens on, as a piece of GLSL every object standing
 * on it can share. The dots, the wireframe over them and the scroll cue that
 * falls into it all call place() with the same clock and the same tilt, so
 * none of them can drift off the surface the others are drawing.
 */
export const TERRAIN = /* glsl */ `
  uniform float uTime;
  uniform float uForm;
  uniform vec2  uTilt;

  // Rolling hills. Three octaves crossing at different rates and directions,
  // which is what keeps the surface from reading as one sine sheet.
  float relief(vec2 p) {
    return sin(p.x * 0.62 + uTime * 0.34) * 1.05
         + sin(p.y * 0.42 - uTime * 0.26) * 1.15
         + sin((p.x + p.y) * 0.31 + uTime * 0.19) * 0.62;
  }

  /**
   * Ground to screen. e is 0 on the ground and 1 on the screen: the sheet
   * scales in, its relief flattens, and it swings up on its own X axis until
   * it is square on to the lens. The pointer tilts the ground while it is
   * still ground, and that tilt is carried out by the same easing.
   */
  vec3 place(vec3 src, float e, out float height, out float shade) {
    // Gathering leads, standing up follows. Run on one curve the sheet spends
    // the middle of the move as a vast tilted plane well past every edge of
    // the frame, and the same count of dots spread over that much area is not
    // a landscape or a window, it is a haze. Pulling in first keeps them
    // dense, so the move reads as ground gathering into a slab and the slab
    // swinging up.
    float es = smoothstep(0.0, 0.66, e);
    float er = smoothstep(0.34, 1.0, e);

    float gx = mix(4.0, 1.0, es);
    float gz = mix(5.6, 1.0, es);
    vec3 p = vec3(src.x * gx, src.y * gz, 0.0);

    float h0 = relief(p.xy);
    height = h0 * (1.0 - es);
    p.z += height;

    // Slope shading. Two more samples give the gradient of the surface, and a
    // fixed light against it separates a hillside that faces the light from
    // the one behind it. Without this every face of every hill carries the
    // same brightness and the relief reads as a pattern printed on a plane
    // rather than as a landscape. Flattened out with the sheet, since a screen
    // has no slopes to catch anything.
    float hx = relief(p.xy + vec2(0.6, 0.0)) - h0;
    float hy = relief(p.xy + vec2(0.0, 0.6)) - h0;
    vec3 normal = normalize(vec3(-hx, -hy, 0.6));
    float lambert = clamp(dot(normal, normalize(vec3(-0.45, 0.35, 0.82))), 0.0, 1.0);
    shade = mix(1.0, lambert, 1.0 - es);

    // Only just short of flat, and deliberately so. Tipping the ground further
    // to look down on it sounds like the way to make a landscape read as three
    // dimensional and does the opposite: seen from above, height differences
    // compress into nothing and the hills go back to being a pattern. Held
    // near grazing they keep their silhouettes, overlap each other, and the
    // grid has to climb over them.
    float pitch = mix(-1.45 + uTilt.y, 0.0, er);
    float cp = cos(pitch);
    float sp = sin(pitch);
    p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);

    float yaw = uTilt.x * (1.0 - er);
    float cy = cos(yaw);
    float sy = sin(yaw);
    p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);

    // Dropped below the lens and pushed back, so the ground runs out to a
    // horizon on the eye line instead of being seen edge on. Only just below:
    // the crests have to clear the eye line, or the hills read as ripples in a
    // floor rather than as a landscape.
    return p + mix(vec3(0.0, -1.85, -5.0), vec3(0.0), er);
  }
`;

