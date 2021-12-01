var camera;
var scene;
var blnWireframe = false //Wireframe toggle
var atlas; //Head morph texture atlas
var mesh; //Head
var uvlayout; //Wireframe
var mat = {}; //Materials from misc texture atlas
var objFacial = {}; //All facial expressions
var textures = new Array(4);
var texMisc = new Array(4);

var canvas = document.getElementById("canvas");
// let mediaStream = canvas.captureStream();
console.log("hello from main.js");

//WebGL test
if (!BABYLON.Engine.isSupported()) {
    $("body").append("<h1>webGL is not enabled on this browser</h1><h2>Please edit your browser settings to enable webGL</h2>");
}
var engine = new BABYLON.Engine(canvas, false);
console.log('main.js:: engine:', engine);
engine.setHardwareScalingLevel(0.5);

//Load scene
BABYLON.SceneLoader.ShowLoadingScreen = false;
BABYLON.SceneLoader.Load("assets/", "head.babylon", engine, function (newScene) {
    newScene.executeWhenReady(function () {
        scene = newScene;
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        // Color4(0,0,0,0) => screen color black
        // Color4(1,1,1,1) => screen color white
        // Color4(0,1,0,1) => screen color parrot
        setupCamera();
        setupLighting();
        // setupCamera(); => loading
        // setupLighting(); => light will noy be there.. and lady face is not visible

        //Head mesh
        mesh = scene.meshes[0];
        //  3d virtual shapes are built from meshes
        mesh.setEnabled(false);

        checkDimensions();
        setupMorphTargets();

        //Load texture atlas for head morph textures
        atlas = new BABYLON.Texture("assets/head_atlas.jpg", scene, true, true, 3, function () {
            setupMaterials();
            setupSkin();
        });

        engine.runRenderLoop(function () {
            scene.render();
        });
    });
});

function setupLighting() {
    var light = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(2, -2, 2), scene);
    light.position = new BABYLON.Vector3(-5, 30, -15);
}

function setupMorphTargets() {
    //Create all facial expression objects
    objFacial.blink = new Facial("Blink", mesh.morphTargetManager.getTarget(0), 100);
    objFacial.pout = new Facial("Pout", mesh.morphTargetManager.getTarget(1), 100);
    objFacial.smile = new Facial("Smile", mesh.morphTargetManager.getTarget(2), 80);
}

function setupMaterials() {
    mat.skin = mesh.material.subMaterials[0];
    mat.eyes = mesh.material.subMaterials[1];
    mat.eyelashes = mesh.material.subMaterials[2];
    mat.ponytail = mesh.material.subMaterials[3];
    mat.teeth = mesh.material.subMaterials[5];

    //Eyes
    var glass = new BABYLON.PBRSpecularGlossinessMaterial("pbr", scene);
    glass.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("assets/environment.dds", scene);
    glass.alpha = 0;
    glass.glossiness = 0.8;
    glass.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    mesh.material.subMaterials[4] = glass;
    mat.eyesOutside = mesh.material.subMaterials[4];

    //Misc textures
    var i = 0;

    for (var w = 0; w < 2; ++w) {
        for (var h = 0; h < 2; ++h) {
            var texture = new BABYLON.Texture("assets/misc.png", scene, true, true, 3);
            texture.uScale = 0.5;
            texture.vScale = 0.5;
            texture.uOffset = w / 2;
            texture.vOffset = h / 2;
            texMisc[i] = texture;
            i++;
        }
    }
    mat.eyelashes.diffuseTexture = texMisc[0];
    mat.eyelashes.opacityTexture = texMisc[0];
    mat.eyelashes.diffuseTexture.hasAlpha = true;
    mat.teeth.diffuseTexture = texMisc[1];
    mat.ponytail.diffuseTexture = texMisc[2];
    mat.eyes.diffuseTexture = texMisc[3];
}

function setupSkin() {
    uvlayout = new BABYLON.Texture("assets/uvlayout.png", scene, true, true, 3, function () {
        var matSkin = mesh.material;
        var matCustom = new BABYLON.CustomMaterial("skin", scene);
        matCustom.AddUniform('texAtlas', 'sampler2D');
        matCustom.AddUniform('texUV', 'sampler2D');
        matCustom.AddUniform('toggle', 'bool');
        matCustom.AddUniform('percentPout', 'float');
        matCustom.AddUniform('percentSmile', 'float');
        matCustom.AddUniform('percentBlink', 'float');

        matCustom.Fragment_Definitions(`      
        vec4 getTextureFromAtlasMap(sampler2D txtRef_0,vec2 pos,vec2 vuv){

        vec2 size = vec2(2048.,2048.);
        vec2 SIZE = vec2(4096.,4096.);
        float uv_w = size.x / SIZE.x;  
        float uv_h = size.y / SIZE.y;   
        float uv_x = pos.x / SIZE.x ;    
        float uv_y = 1.- pos.y / SIZE.y -uv_h; 

        vec2 newUvAtlas = vec2( mod( vuv.x*uv_w, uv_w )+uv_x, mod(vuv.y*uv_h, uv_h)+uv_y  ); 
        vec4 color  = texture2D(txtRef_0 ,newUvAtlas.xy*vec2(1.,1.)+vec2(0.,0.));

        return color ;
        } `);

        matCustom.diffuseTexture = atlas;
        matCustom.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        matCustom.emissiveColor = BABYLON.Color3.White();

        matCustom.onBindObservable.add(function () {
            matCustom.getEffect().setTexture('texAtlas', atlas, scene);
            matCustom.getEffect().setTexture('texUV', uvlayout, scene);
            matCustom.getEffect().setBool('toggle', blnWireframe);
            matCustom.getEffect().setFloat('percentPout', objFacial.pout.textureVal);
            matCustom.getEffect().setFloat('percentSmile', objFacial.smile.textureVal);
            matCustom.getEffect().setFloat('percentBlink', objFacial.blink.textureVal);
        });

        matCustom.Fragment_Before_FragColor(`
        vec4 colUV = texture2D(texUV,vDiffuseUV);
        vec4 colDefault = getTextureFromAtlasMap(texAtlas, vec2(0.,0.), vDiffuseUV);
        vec4 colPout = getTextureFromAtlasMap(texAtlas, vec2(0.,2048.), vDiffuseUV);
        vec4 colSmile = getTextureFromAtlasMap(texAtlas, vec2(2048.,2048.), vDiffuseUV); 
        vec4 colBlink = getTextureFromAtlasMap(texAtlas, vec2(2048.,0.), vDiffuseUV); 

        if (percentPout > percentBlink) {
            if (toggle) {
                color = colUV*0.2 + colPout*percentPout + (1.-percentPout)*colDefault;
            } else {
                color = colPout*percentPout + (1.-percentPout)*colDefault;
            }
        } else if (percentSmile > percentBlink) {
            if (toggle) {
                color = colUV*0.2 + colSmile*percentSmile + (1.-percentSmile)*colDefault;
            } else {
                color = colSmile*percentSmile + (1.-percentSmile)*colDefault;
            }
        } else {
            if (toggle) {    
                color = colUV*0.2 + colBlink*percentBlink + (1.-percentBlink)*colDefault;
            } else {
                color = colBlink*percentBlink + (1.-percentBlink)*colDefault;
            }
        }
        `);

        matSkin.subMaterials[0] = matCustom;

        console.log("Shaders done");
        setupAllSliders();
    });
}

function resetMorph(action) {
    if (action != "blink") {
        objFacial.blink.reset();
    }
    if (action != "smile") {
        objFacial.smile.reset();
    }
    if (action != "pout") {
        objFacial.pout.reset();
    }
}

function setupAllSliders() {
    objFacial.blink.setupSliders();
    objFacial.smile.setupSliders();
    objFacial.pout.setupSliders();

    mesh.setEnabled(true);
    $("#loading").hide();
    $("#canvas").css("background-image", "none");
    console.log("Sliders added");
    setTimeout(function () {
        camera.useAutoRotationBehavior = true;
        camera.autoRotationBehavior.idleRotationWaitTime = 5000;
    }, 5000);
}

function setupCamera() {
    camera = new BABYLON.ArcRotateCamera("ArcRotateCamera", 0, 0, 0, BABYLON.Vector3.Zero(), scene);
    camera.speed = .1;
    camera.lowerBetaLimit = 60 * Math.PI / 180;
    camera.upperBetaLimit = 110 * Math.PI / 180;
    camera.wheelPrecision = 250;
    camera.pinchPrecision = 350;
    camera.fov = 0.6;
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 10;
    camera.radius = 4;
    camera.beta = 2;
    camera.setPosition(new BABYLON.Vector3(0, 0, -4));
    scene.activeCamera = camera;
    camera.attachControl(canvas);
    scene.activeCamera.attachControl(canvas);
}

function toggleWireframe() {
    if (blnWireframe) {
        $("#btnWireframe button").html("Turn wireframe ON");
        blnWireframe = false;
    } else {
        $("#btnWireframe button").html("Turn wireframe OFF");
        blnWireframe = true;
    }
}

function checkDimensions() {
    var width = window.screen.width;
    var height = window.screen.height;
    var isPortrait = (window.innerHeight > window.innerWidth);
    //iPhone 4
    if (height <= 480) {
        if (isPortrait) {
            camera.setPosition(new BABYLON.Vector3(0, 0, -3.7));
        }
    } else if ((width <= 420) && (height > 430) && (height < 736)) {
        if (height <= 640) {
            if (isPortrait) {
                camera.setPosition(new BABYLON.Vector3(0, 0, -4.2));
            } else {
                camera.setPosition(new BABYLON.Vector3(0, 0, -4));
            }
        } else if (height < 736) {
            if (isPortrait) {
                camera.setPosition(new BABYLON.Vector3(0, 0, -6));
            } else {
                camera.setPosition(new BABYLON.Vector3(0, 0, -4));
            }
        }
    } else {
        camera.setPosition(new BABYLON.Vector3(0, 0, -4));
    }
}

function transitionExpression(target) {
    switch (target) {
        case "imgDefault":
            Facial.resetAll();
            break;
        case "imgBlink":
            objFacial.blink.startExpression();
            break;
        case "imgSmile":
            objFacial.smile.startExpression();
            break;
        case "imgPout":
            objFacial.pout.startExpression();
            break;
    }
}

window.addEventListener("resize", function () {
    engine.resize();
    checkDimensions();
});

$(function () {
    $("#HUDleft").on("pointerup", function (e) {
        triggerMouseEvent(canvas, "pointerup");
    })

    $("#canvas").on("pointerleave", function (e) {
        triggerMouseEvent(canvas, "pointerup");
        e.preventDefault();
    });

    $("#faces ul li").on("click", function (e) {
        var target = e.target.id;
        transitionExpression(target);
    });
});

function triggerMouseEvent(node, eventType) {
    var clickEvent = document.createEvent('MouseEvents');
    clickEvent.initEvent(eventType, true, true);
    node.dispatchEvent(clickEvent);
}

//Facial expression class
function Facial(id, morphTarget, max) {
    this.morph = morphTarget;
    this.id = id;
    this.textureVal = 0;
    this.timer;
    this.wait;
    this.max = max;
    this.goingUp = true;
}

Facial.resetAll = function () {
    objFacial.blink.reset();
    objFacial.smile.reset();
    objFacial.pout.reset();
}

Facial.prototype.setupSliders = function () {
    var _this = this;
    $("#sli" + this.id).slider({
        range: "min",
        value: 0,
        min: 0,
        max: this.max,
        slide: function (event, ui) {
            resetMorph(this.id);
            var flValue = ui.value / 100;
            _this.clearTimers();
            _this.textureVal = flValue;
            _this.morph.influence = flValue;
        }
    });
};

Facial.prototype.reset = function () {
    $("#sli" + this.id).slider('value', 0);
    this.clearTimers();
    this.textureVal = 0;
    this.morph.influence = 0;
}

Facial.prototype.clearTimers = function () {
    clearTimeout(this.wait);
    clearTimeout(this.timer);
    this.goingUp = true;
}

Facial.prototype.startExpression = function () {
    Facial.resetAll();
    var _this = this;
    this.reset();
    this.timer = setInterval(function () {
        _this.nextStep();
    }, 50);
}

Facial.prototype.nextStep = function () {
    var step = 0.05;
    var currentValue = this.textureVal;
    var _this = this;
    if (this.goingUp) {
        currentValue += step;
        if (currentValue >= (this.max / 100)) {
            currentValue = this.max / 100;
            this.goingUp = false;
            clearTimeout(this.timer);
            this.wait = setTimeout(function () {
                _this.timer = setInterval(function () {
                    _this.nextStep();
                }, 15)
            }, 1000);
        }
    } else {
        currentValue -= step;
        if (currentValue <= 0.0) {
            this.goingUp = true;
            clearTimeout(this.timer);
        }
    }
    this.textureVal = currentValue;
    this.morph.influence = currentValue;
}

$("#POlogo,#powered,#btnWireframe button").bind('touchend', function (e) {
    e.preventDefault();
    $(this).click();
});

document.addEventListener('touchmove', function (e) {
    e.preventDefault();
}, { passive: false });

console.log('babylon:', BABYLON);
if (BABYLON.VideoRecorder.IsSupported(engine)) {
    console.log('Videorecorder is supported');
    vid = document.getElementById("vid");
    // var recorder = new BABYLON.VideoRecorder(engine);
    // setInterval(()=>{
    //     recorder.startRecording(null, 0.1).then((videoBlob) => {
    //         // Do Something with the videoBlob.
    //         console.log('videoBlob:', videoBlob);
    //         vid.src = URL.createObjectURL(videoBlob); 
    //         // vid.srcObject = videoBlob;
    //     });
    //     // recorder.stopRecording();
    // }, 101);
    // vid.srcObject = engine.getRenderingCanvas().captureStream(25);
}

// function startRecording(){

//     const canvas = engine.getRenderingCanvas();
//     new MediaRecorder(stream, { mimeType: this._options.mimeType });
//     this._mediaRecorder.start(this._options.recordChunckSize);

//     return new Promise<Blob>((resolve, reject) => {
//         this._resolve = resolve;
//         this._reject = reject;
//     });
// }
