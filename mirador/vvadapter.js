(function($){
            
    function IdentSwizzler(imageApiBaseUri, presentationApiBaseUri) {
        this.imageApiBaseUri = imageApiBaseUri;
        this.presentationApiBaseUri = presentationApiBaseUri;
        
        this.iiifPresentationUriRegex = new RegExp(`${presentationApiBaseUri}/([^/]+)/([^/]+)/(.*)`);  // ${presentationApiBaseUri}/<repoName>/<servioceName>/<idSegment>
        this.iiifImageUriRegex = new RegExp(`${imageApiBaseUri}/([^/]+)/([^/]+)/(.*)`);  // ${imageApiBaseUri}/<repoName>/<servioceName>/<idSegment>
    };
    
    IdentSwizzler.prototype = {
        
        manifestIdSegmentRegex: new RegExp(`([^/]+)/manifest.json`),  // <objectId>/manifest.json
        
        canvasIdSegmentRegex: new RegExp(`([^/]+)/canvas/([^/\.]+)\.json(#.*)?`),  // <sequenceId>/canvas/<canvasId>.json
        
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
        
        canvasIdSegment(sequenceId, itemId) {
            return `${sequenceId}/canvas/${itemId}.json`;
        }
    };
    
    
    function AnnotationsAdapter(imageApiBaseUri, presentationApiBaseUri) {
        this.identSwizzler = new IdentSwizzler(imageApiBaseUri, presentationApiBaseUri);
        this.identCreator = new IdentCreator(imageApiBaseUri, presentationApiBaseUri);
    }

    AnnotationsAdapter.prototype = {
        
        alias(resource, aliasDocument) {
            if(Array.isArray(resource)) {
                resource.forEach(item => this.alias(item, aliasDocument));
            }
            else if(Object.prototype.isPrototypeOf(resource)) {
                Object.keys(resource).forEach(key => {
                    let propertyValue = resource[key];
                    this.alias(propertyValue, aliasDocument);
                    if (aliasDocument.hasOwnProperty(key)) {
                        delete resource[key];
                        resource[aliasDocument[key]] = propertyValue;
                    }
                });
            }
        },
        
        normalizeToArrays(resource, fields) {
            fields.forEach((field) => {
                if (resource.hasOwnProperty(field)) {
                    if (!Array.isArray(resource[field])) {
                        resource[field] = [resource[field]];
                    }
                }
            });
        },
        
        // methods for transforming vvannotations to pure open annotations
        
        marshalTargetForMiradorStrategy(iiifAnnotation) {
            let on = iiifAnnotation.on;
            if(on.hasOwnProperty("selector")) {
                if(on.selector.jsonClass == "SelectorChoice") {
                    iiifAnnotation.on = [on];
                }
            }
        },
        
        marshalToIIIFOA(vedavaapiAnnotation) {
            let oaAliasDocument = {
                "target": "on",
                "body": "resource",
                "_id": "@id",
                "type": "@type",
                "source": "full"
            };
            this.alias(vedavaapiAnnotation, oaAliasDocument);
            let iiifAnnotation = vedavaapiAnnotation;
            if(!iiifAnnotation.motivation) {
                iiifAnnotation.motivation = ["oa:commenting"];
            }
            this.normalizeToArrays(iiifAnnotation, ["resource"]);
            this.marshalTargetForMiradorStrategy(iiifAnnotation);
        },
        
        dereferancedOAnnotations(sectionBranch) {
            if (!("annotations" in sectionBranch)) {
                return;  // TODO
            }
            let section = sectionBranch.content;
            
            let annotationSubBranches = sectionBranch.annotations;
            let annotations = annotationSubBranches.map((branch) => branch.content);
            annotations.forEach(annotation => {
                annotation.target = section;
                annotation._id = `${section._id}/${annotation._id}`;
                this.marshalToIIIFOA(annotation);
            });
            return annotations;
        },
    
        annotationListFromTree(pageTree) {
            let annotationList = [];
            if(!("sections") in pageTree) {
                return [];
            }
            let sectionBranches = pageTree.sections;
            for(let sb of sectionBranches) {
                let sectionAnnotations = this.dereferancedOAnnotations(sb);
                annotationList = annotationList.concat(sectionAnnotations);
            }
            return annotationList;
        },
        
        // methods for transforming mirador's open annotations to vedavaapi annotations
        jsonClassMap: {
            "oa:Annotation": "TextAnnotation",
            "oa:Choice": "SelectorChoice",
            "oa:SpecificResource": "SpecificResource",
            "oa:FragmentSelector": "FragmentSelector",
            "oa:SvgSelector": "SvgSelector",
            "dctypes:Text": "Text"
        },
        
        classify(obj) {
            if(Array.isArray(obj)) {
                obj.forEach(item => {
                    this.classify(item);
                });
            }
            else if(Object.prototype.isPrototypeOf(obj)) {
                if(obj.hasOwnProperty("@type")) {
                    let objType = obj["@type"];
                    if (objType in this.jsonClassMap) {
                        if(!obj.jsonClass) {
                            obj.jsonClass = this.jsonClassMap[objType];
                        }
                    }
                }
                Object.keys(obj).forEach(key => {
                    this.classify(obj[key]);
                });
            }
        },
        
        marshalToVVOA(iiifAnnotation) {
            let aliasDocument = {
                "@id": "_id",
                "@type": "type",
                "on": "target",
                "full": "source",
                "resource": "body"
            };
            this.alias(iiifAnnotation, aliasDocument);
        },
        
        removeProps(res, props) {
            if(Array.isArray(res)) {
                res.forEach(item => {
                    this.removeProps(item, props);
                });
            }
            else if(Object.prototype.isPrototypeOf(res)) {
                props.forEach(prop => {
                    if(res.hasOwnProperty(prop)) {
                        delete res[prop];
                    }
                })
                Object.keys(res).forEach(key => {
                    this.removeProps(res[key], props);
                });
            }
        },
        
        swizzleSourcePageId(section) {
            if ("source" in section) {
                let canvasIRI = section.source;
                let {repoName, serviceName, idSegment} = this.identSwizzler.presentationBaseSwizzle(canvasIRI);
                let [, sequenceId, pageId] = this.identSwizzler.canvasIdSwizzle(idSegment);
                section.source = pageId;
            }
        },
        
        annotationToTree(iiifAnnotation) {
            this.classify(iiifAnnotation);
            this.removeProps(iiifAnnotation, ["@context", "within"]);
            this.marshalToVVOA(iiifAnnotation);
            
            let section = iiifAnnotation.target;
            if(Array.isArray(section)) {
                section = section[0];
            }
            this.swizzleSourcePageId(section);
            
            delete iiifAnnotation.target;
            let tree = {
                "content": section,
                "annotations": [
                    {
                        "content": iiifAnnotation
                    }
                ]
            };
            return tree;
        }
    };
    
    $.VedavaapiAnnotationsAdapter = AnnotationsAdapter;
    $.VedavaapiIdentSwizzler = IdentSwizzler;
    $.VedavaapiIdentCreator = IdentCreator;
    
}(Mirador));
