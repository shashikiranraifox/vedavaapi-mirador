/*
A light weight helper for handling sanskrit_ld data.
It just preserves class hierarchy, and provide few convinient methods to build objects easily
*/

// baic classes
let JsonObject = {
    "jsonClass": "JsonObject",
    init() {
        self.jsonClass = self.__proto__.jsonClass;
    },
    
    //static-like
    setDetails(jo, details) {
        //
    },
    
    //static-like
    fromDetails(details) {
        jo = Object.create(this);
        jo.init();
        jo.setDetails(details);
        return jo;
    },
    validate() {
        let requiredProps = this.requiredProperties;
        if(false in requiredProps.map((prop) => Boolean(this[prop]))) {
            return false;
        }
        return true;
    }
};

let MetadataItem = Object.create(JsonObject);
Metadata.jsonClass = "jsonClass";
Metadata.requiredProperties = ["label", "value"];

let Resource = Object.create(JsonObject);
Resource.jsonClass = "Resource";

let Selector = Object.create(JsonObject);
Selector.jsonClass = "Selector";

let SpecificResource = Object.create(Resource);
SpecificResource.jsonClass = "SpecificResource";
SpecificResource.requiredProperties = ["source", "selector"];

let TextResource = Object.create(Resource);
TextResource.jsonClass = "Text";
TextResource.requiredProperties = ["chars"];

let Agent = Object.create(JsonObject);
Agent.jsonClass = "Agent";

let Person = Object.create(Agent);
Person.jsonClass = "Person";

let Annotation = Object.create(Resource);
Annotation.jsonClass = "Annotation";
Annotation.requiredProperties = ["target"];

let FileDescriptor = Object.create(Resource);
FileDescriptor.jsonClass = "FileDescriptor";
FileDescriptor.requiredProperties = ["path"];

let FileAnnotation = Object.create(Annotation);
FileAnnotation.jsonClass = "FileAnnotation";
FileAnnotation.requiredProperties = ["target", "body"];

let QualitativeSelector = Object.create(Selector);
QualitativeSelector.jsonClass = "QualitativeSelector";

let FragmentSelector = Object.create(Selector);
FragmentSelector.jsonClass = "FragmentSelector";
FragmentSelector.requiredProperties = ["value"];

let SvgSelector = Object.create(Selector);
SvgSelector.jsonClass = "SvgSelector";
SvgSelector.requiredProperties = ["value"];

let BookPortion = Object.create(Resource);
BookPortion.jsonClass = "BookPortion";
BookPortion.requiredProperties = ["title"];

let Page = Object.create(SpecificResource);
Page.jsonClass = "Page"
Page.requiredProperties = ["source", "selector"];

let TextAnnotation = Object.create(Annotation);
TextAnnotation.jsonClass = "TextAnnotation";
TextAnnotation.requiredProperties = ["target", "body"];

jsonProtosRegistry = {JsonObject, Resource, Selector, SpecificResource, Text: TextResource, Agent, Annotation, FileDescriptor, FileAnnotation, FragmentSelector, SvgSelector, BookPortion};

function make(normalObject) {
    let jsonClass = normalObject.jsonClass;
    if((!jsonClass) || !(jsonClass in jsonProtosRegistry)) {
        return normalObject;
    }
    jo = {};
    Object.assign(jo, normalObject);
    jo.__proto__ = jsonProtosRegistry[jsonClass]
    Object.keys(jo).forEach(key => {
        jo.key = make(jo.key);
    });
    return jo
}


MetadataItem.setDetails = function(metadataItem, {label, value}) {
    Object.assign(res, {label, value});
};

Resource.setDetails = function(res, {purpose, metadata, canonical, via}) {
    Object.assign(res, {purpose, metadata, canonical, via});
};

Resource.setDetails = function(res, {chars, language, script, ...other}) {
    SpecificResource.setDetails(res, other);
    Object.assign(res, {chars, language, script});
};

Agent.setDetails = function(res, {name, agentClass}) {
    if TextResource.isPrototypeOf(name) {
        //
    }
    else if (typeof(name) == "string") {
        name = TextResource.fromDetails({name});
    }
    res.assign({name, agentClass});
};

Person.

Annotation.setDetails = function(res, {target, ...other}) {
    Resource.setDetails(res, other);
    Object.assign(res, {target});
};

SpecificResource.setDetails = function(res, {source, selector, ..other}) {
    Resource.setDetails(res, other);
    Object.assign({source, selector});
};

FragmentSelector.setDetails = function(res, {value, ...other}) {
    Object.assign(res, {value});
};

SvgSelector.setDetails = function(res, {value, ...other}) {
    Object.assign(res, {value});
};

BookPortion.setDetails = function(res, {title, authors, jsonClassLabel, ...other}) {
    Resource.setDetails(res, other);
    if(typeof(title) == "string") {
        title = TextResource.fromDetails({chars: title});
    }
    if (Array.isArray(authors)) {
        authors = authors.map((author) => ({
            if(typeof(author) == "string") {
                return TextResource.fromDetails({chars: author});
            }
            else {
                return author;
            }
        }));
    }
    Object.assign(res, {title, authors, jsonClassLabel});
};

Page.setDetails = function(res, {source, selector, ...other}) {
    SpecificResource.setDetails(res, other);
    if(!selector) {
        selector = QualitativeSelector.fromDetails();
    }
    Object.assign(res, {source, selector, purpose:"page"});
};
