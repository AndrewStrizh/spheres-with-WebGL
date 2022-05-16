gl = null;

onload = () => {
    const canvas = document.getElementById("canvas");
    let ambientR = 0.5
    let ambientG = 0.5
    let ambientB = 0.5
    initGL(canvas);
    initShaders();
    initBuffers();
    initTexture();
    initTexture2();
    

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    document.onkeydown = KeyDown;
    document.onkeyup = KeyUp;
    canvas.onmousedown = MouseDown;
    document.onmouseup = MouseUp;
    document.onmousemove = MouseMove;
    
    const req = () => {
        Keys();
        drawScene(ambientR,ambientG,ambientB);
        animate();
        requestAnimationFrame(req);
    }
    requestAnimationFrame(req);
}

function initGL(canvas) {
    gl = canvas.getContext("webgl2");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
}


const VS = `#version 300 es
in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat3 uNMatrix;
uniform vec3 uAmbientColor;
uniform vec3 uLightingDirection;
uniform vec3 uDirectionalColor;
uniform bool uUseLighting;
out vec2 vTextureCoord;
out vec3 vLightWeighting;

void main(void) {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
    vTextureCoord = aTextureCoord;

    if (!uUseLighting) {
        vLightWeighting = vec3(1.0, 1.0, 1.0);
    } else {
        vec3 transformedNormal = uNMatrix * aVertexNormal;
        float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
        vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
    }
}
`;

const FS = `#version 300 es
precision mediump float;
in vec2 vTextureCoord;
in vec3 vLightWeighting;
uniform sampler2D uSampler;
out vec4 frag_color;

void main(void) {
    vec4 textureColor = texture(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
    frag_color = vec4(textureColor.rgb * vLightWeighting, textureColor.a);
}
`;

function compileShader(source, type) {
    let glType = type;

    if (type === 'vertex') { glType = gl.VERTEX_SHADER; }
    else if (type === 'fragment') { glType = gl.FRAGMENT_SHADER; }

    const shader = gl.createShader(glType);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);


    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { 
        console.error(`SHADER TYPE ${type}`);
        console.error(gl.getShaderInfoLog(shader));

        return null;
    }

    return shader;
}

let shaderProgram = null;
function initShaders() {
    const fragmentShader = compileShader(FS, 'fragment');
    const vertexShader = compileShader(VS, 'vertex');

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
    shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
}


function handleLoadedTexture(texture) {
    //текстуры, необходимо перевернуть по вертикали из-за разности в системах координат,
    //в PNG-формате значения координат увеличиваются при движении вниз по вертикальной оси
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
    // говорим WebGL, что наша текстура является «текущей»
    gl.bindTexture(gl.TEXTURE_2D, texture);
    //помещение загруженного изображения в пространство видеокарты с помощью texImage2D.
    //Параметры по порядку их передачи: тип используемого изображения, уровень детализации, 
    //формат хранения в видеокарте, 
    //размер каждого «канала» изображения и изображение.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    //Следующие две строки устанавливают специальные параметры масштабирования текстуры.
    //Первый говорит WebGL, что делать, когда текстура заполняет большую часть экрана относительно размера изображения.
    //Второй — эквивалентная подсказка по уменьшению размера изображения.
    //По изображению строятся MIP-уровни — последовательность текстур,
    //каждая следующая из которых по обоим размерам в два раза меньше предыдущей 
    //(если какой-то из размеров стал равен 1, то во всех последующих изображениях он остаётся равным 1).
    //Стандартный способ построения MIP-уровня — изображения разбивается на непересекающиеся квадраты 2x2, 
    //в каждом из которых цвет осредняется.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


let sphereTexture;
function initTexture() {
    sphereTexture = gl.createTexture(); //создание ссылки на текстуру
    sphereTexture.image = new Image(); // создаем объект Image в JavaScript и помещаем его в новый атрибут объекта текстуры
    sphereTexture.image.crossOrigin = "anonymous";
    sphereTexture.image.onload = function () { //загружаем изображение
        handleLoadedTexture(sphereTexture)
    }
    sphereTexture.image.src = "floppa.png";
}


let sphereTexture2;
function initTexture2() {
    sphereTexture2 = gl.createTexture();
    sphereTexture2.image = new Image();
    sphereTexture2.image.crossOrigin = "anonymous";
    sphereTexture2.image.onload = function () {
        handleLoadedTexture(sphereTexture2)
    }

    sphereTexture2.image.src = "floppa.png";
}

const mvMatrix = mat4.create();
let mvMatrixStack = [];
const pMatrix = mat4.create();
//копируем матрицу модель-вид и проекционную матрицу в uniform-переменные шейдера
function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
    //четыре строки для копирования матрицы нормалей на основании матрицы модель-вид
    const normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}


function degToRad(degrees) {
    return degrees * Math.PI / 180;
}


let mouseDown = false;
let lastMouseX = null;
let lastMouseY = null;

let sphereRotationMatrix = mat4.create();
mat4.identity(sphereRotationMatrix);


function MouseDown(event) {
    mouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}


function MouseUp(event) {
    mouseDown = false;
}

function MouseMove(event) {
    if (!mouseDown) {
        return;
    }
    let newX = event.clientX;
    let newY = event.clientY;
    let deltaX = newX - lastMouseX
    let newRotationMatrix = mat4.create();
    mat4.identity(newRotationMatrix);
    mat4.rotate(newRotationMatrix, degToRad(deltaX / 10), [0, 1, 0]);


    let deltaY = newY - lastMouseY;
    if (zPos < -7){
        mat4.rotate(newRotationMatrix, degToRad(-deltaY / 10), [1, 0, 0]);
    } else if (zPos < -3.5 && zPos > -8 && xPos >= 0) {
        mat4.rotate(newRotationMatrix, degToRad(-deltaY / 10), [0, 0, 1]);
    } else if (zPos < -3.5 && zPos > -8 && xPos <= 0) {
        mat4.rotate(newRotationMatrix, degToRad(deltaY / 10), [0, 0, 1]);
    } else {
        mat4.rotate(newRotationMatrix, degToRad(deltaY / 10), [1, 0, 0]);
    }
    mat4.multiply(newRotationMatrix, sphereRotationMatrix, sphereRotationMatrix);
    lastMouseX = newX
    lastMouseY = newY;
}



let sphereVertexPositionBuffer;
let sphereVertexNormalBuffer;
let sphereVertexTextureCoordBuffer;
let sphereVertexIndexBuffer;



let sphereVertexPositionBuffer2;
let sphereVertexNormalBuffer2;
let sphereVertexTextureCoordBuffer2;
let sphereVertexIndexBuffer2;
let indexData = [];
let indexData2 = [];
function initBuffers() {
    const latitudeBands = 100;
    const longitudeBands = 100;
    const radius = 0.5;
    //x = r sinθ cosφ
    //y = r cosθ
    //z = r sinθ sinφ
    const vertexPositionData = [];
    const normalData = [];
    const textureCoordData = [];
    for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
        let theta = latNumber * Math.PI / latitudeBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let longNumber=0; longNumber <= longitudeBands; longNumber++) {
            let phi = longNumber * 2 * Math.PI / longitudeBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            let x = cosPhi * sinTheta;
            let y = cosTheta;
            let z = sinPhi * sinTheta;
            let u = 1 - (longNumber / longitudeBands);
            let v = 1 - (latNumber / latitudeBands);

            normalData.push(x);
            normalData.push(y);
            normalData.push(z);
            textureCoordData.push(u);
            textureCoordData.push(v);
            vertexPositionData.push(radius * x);
            vertexPositionData.push(radius * y);
            vertexPositionData.push(radius * z);
        }
    }

    for (let latNumber=0; latNumber < latitudeBands; latNumber++) {
        for (let longNumber=0; longNumber < longitudeBands; longNumber++) {
            let first = (latNumber * (longitudeBands + 1)) + longNumber;
            let second = first + longitudeBands + 1;
            indexData.push(first);
            indexData.push(second);
            indexData.push(first + 1);

            indexData.push(second);
            indexData.push(second + 1);
            indexData.push(first + 1);
        }

    }


    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalData), gl.STATIC_DRAW);

    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositionData), gl.STATIC_DRAW);

    sphereVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);

    sphereVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordData), gl.STATIC_DRAW);


    const radius2 = 0.5;
    const vertexPositionData2 = [];
    const normalData2 = [];
    const textureCoordData2 = [];
    for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
        let theta = latNumber * Math.PI / latitudeBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let longNumber=0; longNumber <= longitudeBands; longNumber++) {
            let phi = longNumber * 2 * Math.PI / longitudeBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            let x = cosPhi * sinTheta;
            let y = cosTheta;
            let z = sinPhi * sinTheta;
            let u = 1 - (longNumber / longitudeBands);
            let v = 1 - (latNumber / latitudeBands);

            normalData2.push(x);
            normalData2.push(y);
            normalData2.push(z);
            vertexPositionData2.push(radius2 * x);
            vertexPositionData2.push(radius2 * y);
            vertexPositionData2.push(radius2 * z);
            textureCoordData2.push(u);
            textureCoordData2.push(v);
        }
    }

    for (let latNumber=0; latNumber < latitudeBands; latNumber++) {
        for (let longNumber=0; longNumber < longitudeBands; longNumber++) {
            let first = (latNumber * (longitudeBands + 1)) + longNumber;
            let second = first + longitudeBands + 1;
            indexData2.push(first);
            indexData2.push(second);
            indexData2.push(first + 1);

            indexData2.push(second);
            indexData2.push(second + 1);
            indexData2.push(first + 1);
        }
    }

    sphereVertexNormalBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer2);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalData2), gl.STATIC_DRAW);

    sphereVertexPositionBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer2);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositionData2), gl.STATIC_DRAW);

    sphereVertexIndexBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer2);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData2), gl.STATIC_DRAW);

    sphereVertexTextureCoordBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexTextureCoordBuffer2);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordData2), gl.STATIC_DRAW);
}



function drawScene(ambientR,ambientG,ambientB) {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
    const lighting = document.getElementById("lighting").checked;
    gl.uniform1i(shaderProgram.useLightingUniform, lighting);
    if (lighting) {
        gl.uniform3f(
            shaderProgram.ambientColorUniform,
            ambientR,
            ambientG,
            ambientB
        );
        //передаем направление освещения
        let lightingDirection = [
            parseFloat(document.getElementById("lightDirectionX").value),
            parseFloat(document.getElementById("lightDirectionY").value),
            parseFloat(document.getElementById("lightDirectionZ").value)
        ];
        let adjustedLD = vec3.create();
        //vec3.normalize — растягивает вектор или сжимает до единичной длины
        vec3.normalize(lightingDirection, adjustedLD);
        //изменение направления вектора на противоположное. 
        //Это необходимо, потому что мы указываем, куда свет идет, а для расчетов, нам нужно знать, откуда идет свет
        vec3.scale(adjustedLD, -1);
        gl.uniform3fv(shaderProgram.lightingDirectionUniform, adjustedLD);
        //копируем цветовые компоненты направленного освещения в соответствующую uniform-переменную шейдера
        gl.uniform3f(
            shaderProgram.directionalColorUniform,
            parseFloat(document.getElementById("directionalR").value),
            parseFloat(document.getElementById("directionalG").value),
            parseFloat(document.getElementById("directionalB").value)
        );
    }
    
    //Для моделирования камеры в координатах (x, y, z), повернутой на ψ градусов рыскания и на θ градусов тангажа, 
    //мы сначала поворачиваем на -θ градусов вокруг оси X, затем на -ψ градусов вокруг оси Y, а затем перемещаемся в (-x, -y, -z). 
    //После этого матрица находится в режиме, когда все объекты могут использовать мировые координаты,
    //и они автоматически преобразовываются в координаты камеры
    mat4.identity(mvMatrix);
    mat4.rotate(mvMatrix, degToRad(-tang), [1, 0, 0]);
    mat4.rotate(mvMatrix, degToRad(-rs), [0, 1, 0]);
    mat4.translate(mvMatrix, [-xPos, -yPos, -zPos]);
    mat4.translate(mvMatrix, [0, 0, -6]);


    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sphereTexture2);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer2);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer2);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer2);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, indexData2.length, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexTextureCoordBuffer2);
    //gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);



    mat4.translate(mvMatrix,sphereRotationMatrix);
    mat4.multiply(mvMatrix, sphereRotationMatrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sphereTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
}

let PressedKeys = {};

function KeyDown(event) {
    PressedKeys[event.keyCode] = true;
}


function KeyUp(event) {
    PressedKeys[event.keyCode] = false;
}


let tang = 0;
let tangRate = 0;

let rs = 0;
let rsRate = 0;

let xPos = 0;
let yPos = 0.4;
let zPos = 0;

let speed = 0;

function Keys() {
    if (PressedKeys[69]) {
        // Вверх
        tangRate = 0.1;
    } else if (PressedKeys[82]) {
        // Вниз
        tangRate = -0.1;
    } else {
        tangRate = 0;
    }

    if (PressedKeys[65]) {
        // Влево
        rsRate = 0.1;
    } else if (PressedKeys[68]) {
        // Вправо
        rsRate = -0.1;
    } else {
        rsRate = 0;
    }

    if (PressedKeys[87]) {
        // Вперед
        speed = 0.005;
    } else if (PressedKeys[83]) {
        // Назад
        speed = -0.005;
    } else {
        speed = 0;
    }

}

function animate() {
    if (speed != 0) {
        xPos -= Math.sin(degToRad(rs)) * speed * 5;
        zPos -= Math.cos(degToRad(rs)) * speed * 5;
    }
    rs += rsRate * 5;
    tang += tangRate * 5;
}
