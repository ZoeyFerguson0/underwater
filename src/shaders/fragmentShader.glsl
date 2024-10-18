#pragma glslify: voronoi = require('./voronoi3d_basic.glsl')

uniform float u_time;
uniform float u_bFactor;
uniform float u_pcurveHandle;
uniform vec2 u_mousePosition;  // Added uniform for mouse position
varying vec3 v_pos;

// Function from Iñigo Quiles
// www.iquilezles.org/www/articles/functions/functions.htm
// for visual demo, go to https://thebookofshaders.com/edit.php#05/parabola.frag
float parabola( float x, float k ){
    return pow(4.*x*(1.-x), k);
}

// Function from Iñigo Quiles
// www.iquilezles.org/www/articles/functions/functions.htm
// for visual demo, go to https://thebookofshaders.com/edit.php#05/pcurve.frag
float pcurve( float x, float a, float b ){
    float k = pow(a+b,a+b) / (pow(a,a)*pow(b,b));
    return k * pow( x, a ) * pow( 1.0-x, b );
}

void main() {
    // Compute normalized screen coordinates for fragment
    vec2 fragCoord = (gl_FragCoord.xy / vec2(1280.0, 720.0));  // Adjust screen resolution if necessary

    // Calculate distance from mouse position to the current fragment
    float distToMouse = distance(fragCoord, u_mousePosition);

    // Use distance from the mouse to alter the Voronoi computation
    vec2 res = voronoi(v_pos * 0.6 + distToMouse, u_time * 0.3);

    // Interpolate between blue (low res.x) and white (high res.x)
    vec3 blueColor = vec3(0.0, 0.0, 6.0);   // Blue color
    vec3 whiteColor = vec3(1.0, 1.0, 1.0);  // White color

    // Interpolation between blue and white based on res.x
    vec3 mycolor = mix(blueColor, whiteColor, res.x);  // Blue for low res.x, white for high res.x

    // Adjust red + green using pcurve function for a more stylized transition (optional)
    mycolor.r = pcurve(mycolor.r, 15.0, u_pcurveHandle);
    mycolor.g = pcurve(mycolor.g, 13.0, u_pcurveHandle);

    // Calculate alpha based on res.x (lower res.x values will be more transparent)
    float alpha = smoothstep(0.0, 1.0, res.x);

    // Output final color with calculated alpha
    gl_FragColor = vec4(mycolor, alpha);
}
