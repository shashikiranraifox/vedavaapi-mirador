/*
 * annotationsList - current list of OA Annotations
 * dfd - Deferred Object
 * init()
 * search(options, successCallback, errorCallback)
 * create(oaAnnotation, successCallback, errorCallback)
 * update(oaAnnotation, successCallback, errorCallback)
 * deleteAnnotation(annotationID, successCallback, errorCallback)
 *
 * getAnnotationInOA(endpointAnnotation)
 * getAnnotationInEndpoint(oaAnnotation)
 */
(function($){

  $.VedavaapiEndpoint = function(options) {

    jQuery.extend(this, {
      dfd:             null,
      annotationsList: [],  // OA list for Mirador use
      windowID:        null,
      eventEmitter:    null
    }, options);
    this.options = options;

    this.init();
  };

  $.VedavaapiEndpoint.prototype = {
    init() {
        this.annotationsAdapter = new $.VedavaapiAnnotationsAdapter(
                this.options.imageApiBaseUri, this.options.presentationApiBaseUri
        );
        this.identSwizzler = this.annotationsAdapter.identSwizzler;
        this.identCreator = this.annotationsAdapter.identCreator;
    },

    // Search endpoint for all annotations with a given URI in options
    search(options, successCallback, errorCallback) {
        let _this = this;
        _this.annotationsList = [];

        let canvasUri = options.uri;
        let {repoName, serviceName, idSegment} = this.identSwizzler.presentationBaseSwizzle(canvasUri);
        let [, sequenceId, itemId] = this.identSwizzler.canvasIdSwizzle(idSegment);

        let ullekhanamTreeUri = `${_this.ullekhanamApiBaseUri}/trees/${itemId}`
        let params = {
            "max_depth": 2
        };
      
        jQuery.ajax({
            url: ullekhanamTreeUri,
            type: 'GET',
            dataType: 'json',
            xhrFields: { withCredentials: true },
            data: params,
            contentType: "application/json; charset=utf-8",
            success: function(pageTree) {
                _this.annotationsList = _this.annotationsAdapter.annotationListFromTree(pageTree);
                TOBJ = _this.annotationsList;
              if (typeof successCallback === "function") {
                successCallback(_this.annotationsList);
              } else {
                jQuery.each(_this.annotationsList, function(index, value) {
                  value.endpoint = _this;
                });
                if (_this.dfd != null) {
                    _this.dfd.resolve(true);
                }
              }
            },
            error: function(data) {
                console.log(Object.assign(_this.annotationsList));
                if (typeof errorCallback === "function") {
                    errorCallback(data);
                } else {
                    if(_this.dfd != null) {
                       _this.dfd.resolve(true);
                    }
                    console.log("The request for annotations has caused an error for endpoint: " + options.uri);
                }
            }
          });
        },
    
    create: function(iiifAnnotation, successCallback, errorCallback) {
        let _this = this;
        let vvAnnotationTree = _this.annotationsAdapter.annotationToTree(iiifAnnotation);
        
        let ullekhanamTreePostUri =  `${_this.ullekhanamApiBaseUri}/trees`;
        let postBody ={
            "trees": JSON.stringify([vvAnnotationTree])
        };
        
        jQuery.ajax({
            url: ullekhanamTreePostUri,
            type: 'POST',
            headers: {
                // 'X-CSRF-Token': _this.csrfToken()
            },
            data: postBody,
            xhrFields: { withCredentials: true },
            success: function(trees) {
                let sectionTree = trees[0];
                let iiifAnnotation = _this.annotationsAdapter.dereferancedOAnnotations(sectionTree)[0];
                iiifAnnotation.endpoint = _this;
                if (typeof successCallback === "function") {
                    successCallback(iiifAnnotation);
                }
            },
            error: function() {
                if (typeof errorCallback === "function") {
                    errorCallback();
                }
            }
      });
    },
    
    deleteAnnotation(annotationID, successCallback, errorCallback) {
        let _this = this;
        let [sectionId, vvAnnotationId] = annotationID.split("/", 2);
        let parms = {
            "resource_ids": JSON.stringify([sectionId, vvAnnotationId])
        };
        let ullekhanamResourcesDeleteUri =  `${_this.ullekhanamApiBaseUri}/resources`;
        jQuery.ajax({
            url: ullekhanamResourcesDeleteUri,
            type: 'DELETE',
            data: parms,
            xhrFields: { withCredentials: true },
            success: function(data) {
                if (typeof successCallback === "function") {
                    successCallback();
                }
            },
            error: function() {
                if (typeof errorCallback === "function") {
                    errorCallback();
                }
            }
      });
    },
    
    update(oaAnnotation, successCallback, errorCallback) {
        let _this = this;
        let oaAnnotationCopy = JSON.parse(JSON.stringify(oaAnnotation, ((k, v) => k == "endpoint" ? undefined : v)));
        delete oaAnnotationCopy.endpoint;
        
        let [sectionId, vvAnnotationId] = oaAnnotationCopy["@id"].split("/", 2);
        delete oaAnnotationCopy["@id"];
        let vvAnnotationTree = _this.annotationsAdapter.annotationToTree(oaAnnotationCopy);
        vvAnnotationTree.content._id = sectionId;
        vvAnnotationTree.annotations[0].content._id = vvAnnotationId;
        
        let ullekhanamTreePostUri =  `${_this.ullekhanamApiBaseUri}/trees`;
        let postBody ={
            "trees": JSON.stringify([vvAnnotationTree])
        };
    
        jQuery.ajax({
            url: ullekhanamTreePostUri,
            type: 'POST',
            data: postBody,
            xhrFields: { withCredentials: true },
            success: function(trees) {
                let sectionTree = trees[0];
                let iiifAnnotation = _this.annotationsAdapter.dereferancedOAnnotations(sectionTree)[0];
                iiifAnnotation.endpoint = _this;
                if (typeof successCallback === "function") {
                    successCallback(iiifAnnotation);
                }
            },
            error: function() {
                if (typeof errorCallback === "function") {
                    errorCallback();
                }
            }
      });
    },

    set(prop, value, options) {
      if (options) {
        this[options.parent][prop] = value;
      } else {
        this[prop] = value;
      }
    },

    csrfToken() {
      // We need to monkey patch this since $ !== jQuery in Mirador context
      return jQuery('meta[name=csrf-token]').attr('content');
    },
    
    userAuthorize(action, annotation) {
      return true;
    },
    

  };

}(Mirador));




