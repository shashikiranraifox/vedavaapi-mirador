(function($){
        
    function IdentSwizzler(imageApiBaseUri, presentationApiBaseUri) {
        this.imageApiBaseUri = imageApiBaseUri;
        this.presentationApiBaseUri = presentationApiBaseUri;
        
        this.iiifPresentationUriRegex = new RegExp(`${presentationApiBaseUri}/([^/]+)/([^/]+)/(.*)`);  // ${presentationApiBaseUri}/<repoName>/<servioceName>/<idSegment>
        this.iiifImageUriRegex = new RegExp(`${imageApiBaseUri}/([^/]+)/([^/]+)/(.*)`);  // ${imageApiBaseUri}/<repoName>/<servioceName>/<idSegment>
    };
    
    IdentSwizzler.prototype = {
        
        manifestIdSegmentRegex: new RegExp(`([^/]+)/manifest.json`),  // <objectId>/manifest.json
        
        canvasIdSegmentRegex: new RegExp(`([^/]+)/canvas/([^/\.]+)\.json(#.*)?`),  // <objectId>/canvas/<canvasId>.json
        
        annotationIdSegmentRegex: new RegExp(`([^/]+)/annotation/([^/]+)/([^/]+)/([^/\.]*).json`),  // <objectId>/annotation/<canvasId>/<sprId>/<annotationId>.json
        
        listIdSegmentRegex: new RegExp(`([^/]+)/list/([^\]+)/([^/\.]+).json`),  // <objectId>/list/<canvasId>/<listId>.json

        infoIdSegmentRegex: new RegExp(`([^/]+)/info.json`),  // <imageId>/info.json
        
        imageIdSegmentRegex: new RegExp(`([^/]+)/([^/]+)/([^/]+)/([^/]+)/([^/\.]+)\.([^/\.]+)`),  // <imageId>/<region>/<size>/<rotation>/<quality>.<format>
        
        swizzle(str, regex) {
            return str.match(regex);
        },
        
        presentationBaseSwizzle(uri) {
            let uriParts = uri.match(this.iiifPresentationUriRegex);
            return {
                repoName: uriParts[1],
                serviceName: uriParts[2],
                idSegment: uriParts[3]
            };
        },
        
        imageBaseSwizzle(uri) {
            let uriParts = uri.match(this.iiifImageUriRegex);
            return {
                repoName: uriParts[1],
                serviceName: uriParts[2],
                idSegment: uriParts[3]
            };
        },
        
        canvasIdSwizzle(idSegment) {
            let canvasIdParts = idSegment.match(this.canvasIdSegmentRegex);
            return canvasIdParts;
        },
        
        annotationIdSwizzle(idSegment) {
            let annotationIdParts = idSegment.match(this.annotationIdSegmentRegex);
            return annotationIdParts;
        },
        
        listIdSwizzle(idSegment) {
            let listIdParts = idSegment.match(this.listIdSegmentRegex);
            return listIdParts;
        }
    };
    
    
    function IdentCreator(imageApiBaseUri, presentationApiBaseUri) {
        this.imageApiBaseUri = imageApiBaseUri;
        this.presentationApiBaseUri = presentationApiBaseUri;
    }
    
    IdentCreator.prototype = {
        absolutePresentationUri(repoName, serviceName, idSegment) {
            return `${this.presentationApiBaseUri}/${repoName}/${serviceName}/${idSegment}`;
        },
        
        absoluteImageUri(repoName, serviceName, idSegment) {
            return `${this.presentationApiBaseUri}/${repoName}/${serviceName}/${idSegment}`;
        },
        
        manifestIdSegment(objectId) {
            return `${objectId}/manifest.json`;
        },
        
        sequenceIdSegment(objectId, sequenceId) {
            return `${objectId}/sequence/${sequenceId}.json`;
        },
        
        canvasIdSegment(objectId, itemId) {
            return `${objectId}/canvas/${itemId}.json`;
        },
        
        listIdSegment(objectId, itemId, listId) {
            return `${objectId}/list/${itemId}/${listId}.json`;
        },
        
        annotationIdSegment(objectId, itemId, sprId, annotationId) {
            return `${objectId}/annotation/${itemId}/${sprId}/${annotationId}.json`;
        }
    };
    
    
    function AnnotationsAdapter(imageApiBaseUri, presentationApiBaseUri) {
        this.identSwizzler = new IdentSwizzler(imageApiBaseUri, presentationApiBaseUri);
        this.identCreator = new IdentCreator(imageApiBaseUri, presentationApiBaseUri);
    }
    
    AnnotationsAdapter.prototype = {
        makeSource(source_type="user_supplied") {
            /*
            creates a DataSource template. id will be setted on server side.
            */
            let source = {
                "jsonClass": "DataSource",
                "source_type": source_type
            };
            return source;
        },
        
        makeRectangle(x1, y1, w, h) {
            /*
            creates a Rectangle jsonObject structure.
            */
            Object.keys(arguments).forEach(key => arguments[key] = Number(arguments[key]));
            let rectangle = {x1, y1, w, h};
            rectangle.jsonClass ="Rectangle";
            return rectangle;
        },
        
        makeImageTarget(itemId, rectangle) {
            /*
            makes ImageTarget JsonObject structure from target image id, and a Rectangle object
            */
            imageTarget = {
                "jsonClass": "ImageTarget",
                "rectangle": rectangle,
                "container_id": itemId
            };
            return imageTarget;
        },
        
        makeImageAnnotation (itemId, rectangle, source) {
            let imageTarget = this.makeImageTarget(itemId, rectangle);
            imageAnnotation = {
                "jsonClass": "ImageAnnotation",
                "source": source,
                "targets": [imageTarget],
            };
            return imageAnnotation;
        },
        
        makeScriptRendering(text, encodeingScheme) {
            let scriptRendering = {
                "jsonClass": "ScriptRendering",
                "text": text
            };
            if(encodeingScheme) {
                scriptRendering.encodeingScheme = encodeingScheme;
            }
            return scriptRendering;
        },
        
        makeTextObject(scriptRenderings, languageCode) {
            let textObj = {
                "jsonClass": "Text",
                "script_renderings": scriptRenderings
            };
            if(languageCode) {
                textObj.languageCode = languageCode;
            }
            return textObj;
        },
        
        makeTextAnnotation(textObj, source, targets) {
            let textAnnotation = {
                "jsonClass": "TextAnnotation",
                "source": source,
                "content": textObj
            };
            if(Array.isArray(targets)) {
                textAnnotation.targets = targets;
            }
            return textAnnotation;
        },
        
        imageAnnotationFromSpecificResource(specificResource) {
            let canvasId = specificResource.full;
            let defaultSelector = specificResource.selector.default;
            let {serviceName, idSegment} = this.identSwizzler.presentationBaseSwizzle(canvasId);
            let [, objectId, itemId] = this.identSwizzler.canvasIdSwizzle(idSegment);
            // console.log(canvasId, defaultSelector, serviceName, idSegment, objectId, itemId);
            
            let selectorValue = defaultSelector.value
            let selectorValueRegex = new RegExp(`xywh=(-?[0-9]+),(-?[0-9]+),(-?[0-9]+),(-?[0-9]+)`);
            let [, x1, y1, w, h] = selectorValue.match(selectorValueRegex);
            let rectangle = this.makeRectangle(x1, y1, w, h);
            
            let source = this.makeSource();
            
            let imageAnnotation = this.makeImageAnnotation(itemId, rectangle, source);
            return imageAnnotation;
        },
        
        imageAnnotationFromFragmentUri(uri) {
            let {serviceName, idSegment} = this.identSwizzler.presentationBaseSwizzle(uri);
            let [, objectId, itemId, fragment] = this.identSwizzler.canvasIdSwizzle(idSegment);
            let selectorValueRegex = new RegExp(`xywh=([0-9]+),([0-9]+),([0-9]+),([0-9]+)`);
            let [, x1, y1, w, h] = selectorValue.match(selectorValueRegex);
            let rectangle = this.makeRectangle(x1, y1, w, h);
            
            let source = this.makeSource();
            
            let imageAnnotation = this.makeImageAnnotation(itemId, rectangle, source);
            return imageAnnotation;
        },
        
        textObjectFromText(text, languageCode, encodeingScheme) {
            let scriptRendering = this.makeScriptRendering(text, encodeingScheme);
            let textObj = this.makeTextObject([scriptRendering], languageCode);
            return textObj;
        },
        
        textAnnotationFromResource(textResource, languageCode, encodeingScheme) {
            let text = textResource.chars;
            let textObj = this.textObjectFromText(text, languageCode, encodeingScheme);
            let source = this.makeSource();
            let textAnnotation = this.makeTextAnnotation(textObj, source);
            return textAnnotation;
        },
        
        makeJsonObjectNode(content, children) {
            let joNode = {
                "jsonClass": "JsonObjectNode",
                "content": content,
                "children": children
            };
            return joNode;
        },
        
        oa2vv (oa) {
            TOBJ = oa; // temporary testing object in window
            let on = oa.on;
            let specificResource = Array.isArray(on) ? on[0]: on;
            let imageAnnotation = Object.prototype.isPrototypeOf(on) ?  this.imageAnnotationFromSpecificResource(specificResource) : this.imageAnnotationFromFragmentUri(on);
            let resource = oa.resource;
            let textResource = Array.isArray(resource) ? resource[0] : resource;
            let textAnnotation = this.textAnnotationFromResource(textResource);
            if("@id" in oa) {
                let {idSegment} = this.identSwizzler.presentationBaseSwizzle(oa['@id']);
                let [,objectId, itemId, sprId, textAnnId] = this.identSwizzler.annotationIdSwizzle(idSegment);
                imageAnnotation['_id'] = sprId;
                if(textAnnId != '') {
                    textAnnotation['_id'] = textAnnId;
                }
            }
            let textAnnotaionJONode = this.makeJsonObjectNode(textAnnotation, []);
            let imageAnnotationJONode = this.makeJsonObjectNode(imageAnnotation, [textAnnotaionJONode]);
            return imageAnnotationJONode;
        },
        
        fragmentSelectorFromRectangle(rectangle) {
            let fragmentSelector = {
                "@type": "oa:FragmentSelector",
                "value": `xywh=${rectangle.x1},${rectangle.y1},${rectangle.w},${rectangle.h}`
            };
            return fragmentSelector;
        },
        
        svgSelectorFromSvg(svg) {
            let svgSelector = {
                "@type": "oa:SvgSelector",
                "value": svg
            };
            return svgSelector;
        },
        
        choiceObject(defaultOne, item) {
            let choiceObject = {
                "@type": "oa:Choice",
                "default": defaultOne,
                "item": item
            };
            return choiceObject;
        },
        
        textResourceFromTextAnnotation(textAnnotation) {
            let chars = textAnnotation.content.script_renderings[0].text;
            let language = textAnnotation.content.language_ode;
            let textResource = {
                "@type": "cnt:ContentAsText",  // can also be "dctypes:Text"
                "format": "text/html",
                "chars": chars
            };
            if(language) {
                textResource.language = language;
            }
            return textResource;
        },
        
        
        specificResourceFromImageAnnotation(canvasUri, imageAnnotation) {
            // as now, there is no standardised key in imageAnnotation model to represent svg, now it only returns default fragmentSelector. will be changed soon after discussion.
            let selector = this.fragmentSelectorFromRectangle(imageAnnotation.targets[0].rectangle);
            let specificResource = {
                "@type": "oa:SpecificResource:",
                "full": canvasUri,
                "selector": selector,
            };
            return specificResource;
        },
        
        openAnnotationId(canvasUri, joNode) {
            let imageAnnotation = joNode.content;
            let textAnnotation = joNode.children[0].content;
            let {repoName, serviceName, idSegment} = this.identSwizzler.presentationBaseSwizzle(canvasUri);
            let [, objectId, itemId] = this.identSwizzler.canvasIdSwizzle(idSegment);
            let oaIdSegment = this.identCreator.annotationIdSegment(objectId, itemId, imageAnnotation._id, textAnnotation._id);
            let oaId = this.identCreator.absolutePresentationUri(repoName, serviceName, oaIdSegment);
            return oaId;
        },
        
        openAnnotationSource(vvSource) {
            return {
                "@id": vvSource.id,
                "@type": vvSource.source_type
            };
        },
        
        openAnnotationFromJONode(canvasUri, joNode) {
            let imageAnnotation = joNode.content;
            let textAnnotation = joNode.children[0].content;
            let openAnnotation = {
                "@id": this.openAnnotationId(canvasUri, joNode),
                "@type":  "oa:Annotation",
                "motivation": "sc:painting",
                "on": this.specificResourceFromImageAnnotation(imageAnnotation),
                "resource": this.textResourceFromTextAnnotation(textAnnotation)
            };
            if ("source" in imageAnnotation) {
                openAnnotation.on.creator = this.openAnnotationSource(imageAnnotation.source);
            }
            if("source" in textAnnotation) {
                openAnnotation.creator = this.openAnnotationSource(textAnnotation.source);
            }
            return openAnnotation;
        },
        
        updateOpenAnnotationValues(openAnnotation, joNode) {
            let imageAnnotation = joNode.content;
            let textAnnotation = joNode.children[0].content;
            let on = openAnnotation.on;
            let specificResource = Array.isArray(on) ? on[0]: on;
            let oaId = this.openAnnotationId(specificResource.full, joNode);
            if ("source" in imageAnnotation) {
                openAnnotation.on.creator = this.openAnnotationSource(imageAnnotation.source);
            }
            if("source" in textAnnotation) {
                openAnnotation.creator = this.openAnnotationSource(textAnnotation.source);
            }
            openAnnotation["@id"] = oaId;
            return openAnnotation;
        }
    };
    
    $.VedavaapiAnnotationsAdapter = AnnotationsAdapter;
    $.VedavaapiIdentSwizzler = IdentSwizzler;
    $.VedavaapiIdentCreator = IdentCreator;
    
}(Mirador))
