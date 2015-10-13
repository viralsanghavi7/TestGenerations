var esprima = require("esprima");
var options = {
    tokens: true,
    tolerant: true,
    loc: true,
    range: true
};
var faker = require("faker");
var fs = require("fs");
faker.locale = "en_US";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');


var fileName = "/'/''";

function main() {
    var args = process.argv.slice(2);

    if (args.length == 0) {
        args = ["subject.js"];
    }
    var filePath = args[0];

    constraints(filePath);

    generateTestCases()

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue(greaterThan, constraintValue) {
    if (greaterThan)
        return Random.integer(constraintValue, constraintValue + 10)(engine);
    else
        return Random.integer(constraintValue - 10, constraintValue)(engine);
}

function Constraint(properties) {
    this.ident = properties.ident;
    this.expression = properties.expression;
    this.operator = properties.operator;
    this.value = properties.value;
    this.funcName = properties.funcName;
    // Supported kinds: "fileWithContent","fileExists"
    // integer, string, phoneNumber
    this.kind = properties.kind;
}

function fakeDemo() {

    return faker.phone.phoneNumberFormat();

}

var functionConstraints = {}

var mockFileLibrary = {
    pathExists: {
        'path/fileExists': {
            pathContent: {
                file1: 'text content',
                file2: ''
            }
        },

        'path/fileExists1': {}

    },
    fileWithContent: {
        pathContent: {
            file1: 'text content',
            file2: ''
        }
    }
};

function generateTestCases() {

    var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
    for (var funcName in functionConstraints) {




        // update parameter values based on known constraints.
        var constraints = functionConstraints[funcName].constraints;

        // Handle global constraints...
        var fileWithContent = _.some(constraints, {
            kind: 'fileWithContent'
        });
        var pathExists = _.some(constraints, {
            kind: 'fileExists'
        });


        var paramArray = [];
        for (var c = 0; c < constraints.length; c++) {




            if (constraints[c].ident == fileName && (constraints[c].kind == "fileExists" || constraints[c].kind == "fileExists1")) {

                console.log("Inside if");
                constraints[c].value = '\'pathContent/file1\'';

            }



            var params = {};


            // initialize params
            for (var i = 0; i < functionConstraints[funcName].params.length; i++) {
                var paramName = functionConstraints[funcName].params[i];
                //params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
                params[paramName] = '\'\'';
            }


            var constraint = constraints[c];


            //console.log(constraint);

            if (params.hasOwnProperty(constraint.ident)) {
                params[constraint.ident] = constraint.value;
            }




            // Prepare function arguments.
            var args = Object.keys(params).map(function(k) {
                return params[k];
            });

            for (var j = 0; j < args.length; j++) {


                if (paramArray[j] == undefined) {

                    paramArray[j] = [];
                }

                if (args[j] != "\'\'")
                    paramArray[j].push(args[j]);

            }



        }

        console.log("param array");
        //console.log(paramArray);


        if (paramArray.length > 0) {



            for (var j = 0; j < paramArray.length; j++) {

                var flag = 0;
                for (var x = 0; x < paramArray[j].length; x++) {
                    console.log(paramArray[j][x]);
                    console.log(paramArray[j][x] === "\'pathContent/file1Negative\'");
                    console.log(paramArray[j][x] === "\'pathContent/file1\'");
                    console.log(paramArray[j][x] === "\'pathContent/file2\'");
                    if (paramArray[j][x] === "\'pathContent/file1Negative\'" || paramArray[j][x] === "\'pathContent/file1\'" || paramArray[j][x] === "\'pathContent/file2\'") {
                        flag = 1;
                        break;
                    }
                }

                if (flag == 0) {
                    paramArray[j].push('\'\'');
                }

            }

            console.log(paramArray);
            var allCombinations = [];
            allCombinations = findCombinations(paramArray);


            for (var j = 0; j < allCombinations.length; j++) {
                

                if (pathExists || fileWithContent) {
                    content += generateMockFsTestCases(pathExists, fileWithContent, funcName, allCombinations[j].split(','));
                    content += generateMockFsTestCases(!pathExists, fileWithContent, funcName, allCombinations[j].split(','));
                    content += generateMockFsTestCases(pathExists, !fileWithContent, funcName, allCombinations[j].split(','));
                    content += generateMockFsTestCases(!pathExists, !fileWithContent, funcName, allCombinations[j].split(','));
                    // Bonus...generate constraint variations test cases....
                } else {
                    // Emit simple test case.
                    content += "subject.{0}({1});\n".format(funcName, allCombinations[j].split(','));
                }

            }


        } else {

            if (pathExists || fileWithContent) {
                content += generateMockFsTestCases(pathExists, fileWithContent, funcName, args);
                // Bonus...generate constraint variations test cases....
            } else {
                // Emit simple test case.
                content += "subject.{0}({1});\n".format(funcName, args);
            }

        }




    }
    fs.writeFileSync('test.js', content, "utf8");


}

function generateMockFsTestCases(pathExists, fileWithContent, funcName, args) {
    var testCase = "";
    // Build mock file system based on constraints.
    var mergedFS = {};
    if (pathExists) {
        for (var attrname in mockFileLibrary.pathExists) {
            mergedFS[attrname] = mockFileLibrary.pathExists[attrname];
        }
    }
    if (fileWithContent) {
        for (var attrname in mockFileLibrary.fileWithContent) {
            mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname];
        }
    }

    testCase +=
        "mock(" +
        JSON.stringify(mergedFS) +
        ");\n";

    testCase += "\tsubject.{0}({1});\n".format(funcName, args);
    testCase += "mock.restore();\n";
    return testCase;
}

function constraints(filePath) {
    var buf = fs.readFileSync(filePath, "utf8");
    var result = esprima.parse(buf, options);

    traverse(result, function(node) {
        if (node.type === 'FunctionDeclaration') {

            var funcName = functionName(node);
            console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName));

            var params = node.params.map(function(p) {
                return p.name
            });

            console.log(params);

            functionConstraints[funcName] = {
                constraints: [],
                params: params
            };
            for (var x = 0; x < params.length; x++) {

                if (params[x] == "phoneNumber") {
                    var tempPhoneNumber = "\"" + fakeDemo() + "\"";
                    functionConstraints[funcName].constraints.push(
                        new Constraint({
                            ident: "phoneNumber",
                            value: tempPhoneNumber,
                            funcName: funcName,
                            kind: "string",
                            operator: "operator",
                            expression: "expression"
                        }));
                }
            }


            // Check for expressions using argument.
            traverse(node, function(child) {




                if (child.left) {

                    if (child.left.type === 'UnaryExpression') {



                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: child.left.argument.name,
                                value: "true",
                                funcName: funcName,
                                kind: "string",
                                operator: "operator",
                                expression: "expression"
                            }));


                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: "formatString",
                                value: "\"abc\"",
                                funcName: funcName,
                                kind: "string",
                                operator: "operator",
                                expression: "expression"
                            }));




                    }

                }



                if (child.right) {

                    if (child.right.type === 'UnaryExpression') {



                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: child.right.argument.name,
                                value: "true",
                                funcName: funcName,
                                kind: "string",
                                operator: "operator",
                                expression: "expression"
                            }));


                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: "formatString",
                                value: "\"abc\"",
                                funcName: funcName,
                                kind: "string",
                                operator: "operator",
                                expression: "expression"
                            }));


                        if (child.right.argument.property) {
                            var property = child.right.argument.property.name;
                            var name = child.right.argument.object.name;

                            var valtrue = "{" + "\"" + property + "\": true}";
                            var valfalse = "{" + "\"" + property + "\": false}";
                            var valnull = "\'\'";




                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: name,
                                    value: valtrue,
                                    funcName: funcName,
                                    kind: "string",
                                    operator: "operator",
                                    expression: "expression"
                                }));


                            functionConstraints[funcName].constraints.push(

                                new Constraint({
                                    ident: name,
                                    value: valnull,
                                    funcName: funcName,
                                    kind: "string",
                                    operator: "operator",
                                    expression: "expression"
                                }));


                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: name,
                                    value: valfalse,
                                    funcName: funcName,
                                    kind: "string",
                                    operator: "operator",
                                    expression: "expression"
                                }));



                        }
                    }
                }




                if (child.type === 'BinaryExpression' && (child.operator == "==" || child.operator == "<" || child.operator == ">" || child.operator == "!=" || child.operator == "<=" || child.operator == ">=")) {



                    if (funcName == "blackListNumber" && child.left.type == 'Identifier') {

                        var rightHand = buf.substring(child.right.range[0], child.right.range[1]);


                        var x = fakeDemo();
                        console.log(x.substring(0, 3));
                        var y = x.replace(x.substring(0, 3), rightHand.substring(1, rightHand.length - 1));


                        var tempPhoneNumber = "\"" + y + "\"";
                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: "phoneNumber",
                                value: tempPhoneNumber,
                                funcName: funcName,
                                kind: "string",
                                operator: "operator",
                                expression: "expression"
                            }));



                    }


                    if (child.left.type == 'Identifier' && params.indexOf(child.left.name) > -1) {
                        // get expression from original source code:
                        var expression = buf.substring(child.range[0], child.range[1]);
                        var rightHand = buf.substring(child.right.range[0], child.right.range[1])

                        var value1 = ' ';
                        var value2 = ' ';
                        if (child.operator == "==") {
                            value1 = rightHand;
                            value2 = makeNotEqual(rightHand);
                        } else if (child.operator == "<" || child.operator == ">" || child.operator == ">=" || child.operator == "<=") {
                            value1 = parseInt(rightHand) - 1;
                            value2 = parseInt(rightHand) + 1;
                        } else if (child.operator == "!=") {
                            value1 = makeNotEqual(rightHand);
                            value2 = rightHand;
                        }

                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: child.left.name,
                                value: value1,
                                funcName: funcName,
                                kind: "integer",
                                operator: child.operator,
                                expression: expression
                            }));

                        functionConstraints[funcName].constraints.push(
                            new Constraint({
                                ident: child.left.name,
                                value: value2,
                                funcName: funcName,
                                kind: "integer",
                                operator: child.operator,
                                expression: expression
                            }));
                    }




                    if (child.left.type == "CallExpression" && params.indexOf(child.left.name) <= -1) {



                        if (child.left.callee.property.name == "indexOf") {




                            var value = child.left.callee.object.name;

                            value = "\"" + value.substr(0, child.right.value) + child.left.arguments[0].value + value.substr(child.right.value + 1) + "\"";


                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: child.left.callee.object.name,
                                    value: value,
                                    funcName: funcName,
                                    kind: "integer",
                                    operator: child.operator,
                                    expression: expression
                                }));

                        }
                    }
                }


                if (child.type == "CallExpression" &&
                    child.callee.property &&
                    child.callee.property.name == "readFileSync") {




                    for (var p = 0; p < params.length; p++) {
                        if (child.arguments[0].name == params[p]) {

                            fileName = params[p];
                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: params[p],
                                    value: "'pathContent/file1'",
                                    funcName: funcName,
                                    kind: "fileWithContent",
                                    operator: child.operator,
                                    expression: expression
                                }));


                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: params[p],
                                    value: "'pathContent/file1Negative'",
                                    funcName: funcName,
                                    kind: "fileWithContent",
                                    operator: child.operator,
                                    expression: expression
                                }));


                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: params[p],
                                    value: "'pathContent/file2'",
                                    funcName: funcName,
                                    kind: "fileWithContent",
                                    operator: child.operator,
                                    expression: expression
                                }));
                        }
                    }
                }

                if (child.type == "CallExpression" &&
                    child.callee.property &&
                    child.callee.property.name == "existsSync") {
                    for (var p = 0; p < params.length; p++) {
                        if (child.arguments[0].name == params[p]) {



                            //console.log(params);
                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: params[p],
                                    // A fake path to a file
                                    value: "'path/fileExists'",
                                    funcName: funcName,
                                    kind: "fileExists",
                                    operator: child.operator,
                                    expression: expression
                                }));


                            functionConstraints[funcName].constraints.push(
                                new Constraint({
                                    ident: params[p],
                                    // A fake path to a file
                                    value: "'path/fileExists1'",
                                    funcName: funcName,
                                    kind: "fileExists",
                                    operator: child.operator,
                                    expression: expression
                                }));

                        }
                    }
                }

            });



        }
    });
}

function traverse(object, visitor) {
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor) {
    var key, child;

    if (visitor.call(null, object)) {
        for (key in object) {
            if (object.hasOwnProperty(key)) {
                child = object[key];
                if (typeof child === 'object' && child !== null) {
                    traverseWithCancel(child, visitor);
                }
            }
        }
    }
}

function functionName(node) {
    if (node.id) {
        return node.id.name;
    }
    return "";
}


if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}




function findCombinations(input) {



    if (input.length == 1) {
        return input[0];
    } else {
        var result = [];
        var allCombinations = findCombinations(input.slice(1)); // recur with the rest of array
        for (var i = 0; i < allCombinations.length; i++) {
            for (var j = 0; j < input[0].length; j++) {
                result.push(input[0][j] + "," + allCombinations[i]);
            }
        }

        return result;
    }

}


function makeNotEqual(rightHand) {


    if (rightHand === "undefined")
        return 1;
    if (rightHand.charCodeAt(0) >= 48 && rightHand.charCodeAt(0) <= 67) {
        value = rightHand - 1;
    } else {
        value = rightHand.substring(0, rightHand.length - 1).concat("xyz").concat("\"");
    }


    return value;
}

main();