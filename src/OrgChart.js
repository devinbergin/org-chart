if (!window["oj"]) {
    window["oj"] = {};
}

if (!oj.visualization) {
    oj.visualization = {};
}

if (!oj.utilities) {
    oj.utilities = {};
}

//Events class
oj.utilities.Events = function(eventTypesArr) {
    this.eventTypes = {};
    this.events = {};
    for (var i = 0; i < eventTypesArr.length; i++) {
        this.eventTypes[eventTypesArr[i]] = true;
    }
};

//Static functions
oj.utilities.Events.bindHandler = function(functionObj, thisObj, args) {
    args = args || [];
    return function(eventObject) {
        eventObject = eventObject || window.event;
        args.unshift(eventObject);
        functionObj.apply(thisObj, args);
    };
};

//Public functions
oj.utilities.Events.prototype = (function() {
    var setEventListener = function(eventType, handler) {
        if (this.eventTypes[eventType]) {
            this.events[eventType] = handler;
            return true;
        }
        return false;
    };

    var triggerEvent = function(eventType, eventObject) {
        if (this.eventTypes[eventType] && this.events[eventType]) {
            this.events[eventType](eventObject);
            return true;
        }
        return false;
    };

    return {
        "setEventListener": setEventListener,
        "triggerEvent": triggerEvent
    };
})();

oj.visualization.OrgChart = (function() {
    var nodePositions = {
        "LEFTMOST": "0",
        "BETWEEN": "1",
        "RIGHTMOST": "2",
        "ONENODE": "3"
    };

    var positionClasses = [
        ["", "top left"],
        ["top", "top left"],
        ["top", "left"],
        ["", "left"]
    ];

    var classes = {
        "node": "node",
        "node2": "node2",
        "node3": "node3",
        "childStub": "left",
        "chart": "oj-orgchart",
        "node-hover": "hover",
        "visiblity": "hidden"
    };

    var createNode = function(nodeType, inputObj) {
        var element = document.createElement(nodeType);
        if (inputObj) {
            inputObj["className"] && inputObj["className"].length > 0 && (element.className = inputObj["className"]);
            if (inputObj["attributes"]) {
                for (var i in inputObj["attributes"]) {
                    element.setAttribute(i, inputObj["attributes"][i]);
                }
            }
            inputObj["parent"] && inputObj["parent"].appendChild(element);
            inputObj["innerHTML"] && (element.innerHTML = inputObj["innerHTML"]);
            if (inputObj["eventHandlers"]) {
                if (element.addEventListener) {
                    var addFunction = "addEventListener";
                    var handlerPrefix = "";
                } else {
                    addFunction = "attachEvent";
                    handlerPrefix = "on";
                }
                for (i in inputObj["eventHandlers"]) {
                    element[addFunction](handlerPrefix + i, inputObj["eventHandlers"][i]);
                }
            }
        }
        return element;
    };

    //Inner node class
    var Node = function(inputObj) {
        if (inputObj.name === "" || !inputObj.name) {
            throw "Node name not provided for the node";
        }
        this.name = inputObj["name"];
        this.tooltip = inputObj["tooltip"] || "";
        this.nodeLevel = inputObj["nodeLevel"] || "";
        this.data = inputObj["data"] || undefined;
        this.userData = inputObj["userData"];
        this.nodePosition = inputObj["nodePosition"];
        this.setParentNode(inputObj["parentNode"]);
        this.constructor = arguments.callee;
        // node-hover
        this.events = {};
        this.orgChart = inputObj["orgChart"];
        this.nodeIndex = inputObj["nodeIndex"];
        this.isCollapsed = false;
        this.isHidden = false;
        this.isClicked = false;
    };

    Node.prototype = new oj.utilities.Events(["node-hover"]);

    (function(prototypeObject) {
        var setParentNode = function(parentNodeObj) {
            this.parentNode = parentNodeObj;
            this.isRootNode = !parentNodeObj;
            this.nodeDepth = parentNodeObj ? (parentNodeObj.nodeDepth + 1) : 0;
        };

        var setChildNodes = function(childNodes, leafNodeCount) {
            if (childNodes.length === 0) {
                this.isLeafNode = true;
                this.childNodes = undefined;
            } else {
                this.isLeafNode = false;
                this.childNodes = childNodes;
            }
        };

        var setDimensions = function(leafNodeCount, index, depthMap) {
            this.leafNodeCount = !this.childNodes ? 1 : leafNodeCount;
            var targetSize = this.leafNodeCount * 8;
            this.dimensionMatrix = getDimensionMatrix(targetSize);
            this.depthMap = depthMap;
            setLeafNodeIndices(this, index);
            leftSideCorrection(this, depthMap[depthMap.length - 1]);
            !this.isLeafNode && centralizeNode(this);
        };

        var setLeafNodeIndices = function(nodeObj, index) {
            if (nodeObj.isLeafNode) {
                nodeObj.startLeafIndex = index;
                nodeObj.endLeafIndex = index;
            } else {
                nodeObj.startLeafIndex = nodeObj.childNodes[0].startLeafIndex;
                nodeObj.endLeafIndex = nodeObj.childNodes.slice(-1)[0].endLeafIndex;
            }
        };

        var leftSideCorrection = function(currentNode, previousNode) {
            var toAdd = (currentNode.startLeafIndex - (previousNode ? previousNode.endLeafIndex : 0) - 1) * 8;
            toAdd > 0 && currentNode.dimensionMatrix.forEach(function(elmt, i, arr) {
                elmt[0] = elmt[0] + toAdd;
            });
        };

        var getNodeWidth = function() {
            return this.dimensionMatrix[1].reduce(function(a, b) {
                return a + b;
            });
        };

        var centralizeNode = function(nodeObj) {
            var firstChild = nodeObj.childNodes[0];
            var lastChild = nodeObj.childNodes.slice(-1)[0];
            if (nodeObj.name == "b") {
                debugger;
            }
            var distObj = getDistanceBetween(firstChild, lastChild);
            var currentPosition = getDistanceFromStart(nodeObj)["distance"];
            var targetPosition = distObj["fromNodeDistance"] + distObj["distanceBetween"] / 2;
            var offset = Math.round(targetPosition - currentPosition);
            offset !== 0 && addOffset(nodeObj, offset);
        };

        var getDistanceBetween = function(fromNode, toNode) {
            var distObj = getDistanceFromStart(fromNode);
            var startIndex = distObj["index"];
            var depthMap = toNode.depthMap;
            var distBetween = -(fromNode.dimensionMatrix[1][0]);
            for (var i = startIndex;
                (i < depthMap.length && depthMap[i] != toNode); i++) {
                distBetween += depthMap[i].getNodeWidth();
            }
            distBetween += toNode.dimensionMatrix[1][0];
            return {
                "fromNodeDistance": distObj["distance"],
                "distanceBetween": distBetween
            };
        };

        var getDistanceFromStart = function(node) {
            var distance = 0;
            var depthMap = node.depthMap;
            for (var i = 0;
                (i < depthMap.length && depthMap[i] != node); i++) {
                distance += depthMap[i].getNodeWidth();
            }
            distance += node.dimensionMatrix[1][0];
            return {
                "distance": distance,
                "index": i
            };
        };

        var addOffset = function(nodeObj, offset) {
            nodeObj.dimensionMatrix[0][0] += offset;
            nodeObj.dimensionMatrix[0][1] -= offset;
            nodeObj.dimensionMatrix[1][0] += offset;
            nodeObj.dimensionMatrix[1][2] -= offset;
            nodeObj.dimensionMatrix[2][0] += offset;
            nodeObj.dimensionMatrix[2][1] -= offset;
        };

        var getTotalDimension = function(nodes) {
            var totalSize = nodes.reduce(function(a, b) {
                var aSize = a.constructor == Node ? a.getNodeWidth() : a;
                return aSize + b.getNodeWidth();
            });
            return totalSize;
        };

        var getDimensionMatrix = function(targetSize) {
            var connectionSize = targetSize / 2;
            var nodePadding = (targetSize - 6) / 2;
            return [
                [connectionSize, connectionSize], [nodePadding, 6, nodePadding], [connectionSize, connectionSize]
            ];
        };

        var getHTMLContent = function() {
            this.htmlContent = [];
            for (var i = 0; i < this.dimensionMatrix.length; i++) {
                this.htmlContent[i] = [];
                for (var j = 0; j < this.dimensionMatrix[i].length; j++) {
                    var properties = {
                        "attributes": {}
                    };
                    var className = "";
                    if (i === 0 && !this.isRootNode) {
                        className = positionClasses[this.nodePosition][j];
                    } else if (i == 1 && j == 1) {
                        // Append nodeLevel to class name to use diff styles for diff levels
                        className = classes["node"+this.nodeLevel];
                        this.orgChart["options"]["editable"] && (properties["attributes"]["draggable"] = "true");
                        this.tooltip.length > 0 && (properties["attributes"]["title"] = this.tooltip);
                    } else if (i == 2 && j == 1 && !this.isLeafNode) {
                        className = classes["childStub"];
                    }
                    className.length > 0 && (properties["className"] = className);
                    properties["attributes"]["colspan"] = this.dimensionMatrix[i][j];
                    var element = this.htmlContent[i][j] = createNode("td", properties);
                    if (i == 1 && j == 1) {
                        element.innerHTML = this.name;
                        element.onmouseover = oj.utilities.Events.bindHandler(mouseOverHandler, this);
                        element.onmouseout = oj.utilities.Events.bindHandler(mouseOutHandler, this);
                        element.nodeObject = this;
                    }
                }
            }
            return this.htmlContent;
        };

        var mouseOverHandler = function(eventObject) {
            this.orgChart["options"]["showHoverColors"] && this.applyNodeStyle(true, classes["node-hover"]);
            triggerUserEvent("node-hover", eventObject, this);
        };

        var mouseOutHandler = function(eventObject) {
            this.orgChart["options"]["showHoverColors"] && this.applyNodeStyle(false, classes["node-hover"]);
        };

        var applyNodeStyle = function(setStyle, className) {
            var actionFunc = !this.orgChart["options"]["highlightSubtree"] ? setNodeStyle : setSubtreeStyle;
            actionFunc(this, setStyle, className);
        };

        var setNodeStyle = function(node, isSet, className) {
            var action = isSet ? "add" : "remove";
            node.htmlContent[1][1].classList[action](className);
        };

        var setSubtreeStyle = function(node, isSet, className) {
            var action = isSet ? "add" : "remove";
            var cacheKey = node.toString();
            var childArray = node.orgChart.childNodeCache[cacheKey];
            for (var i = 0; i < childArray.length; i++) {
                var currentNode = childArray[i];
                var cells = currentNode.htmlContent;
                if (currentNode.toString() != cacheKey) {
                    cells[0][0].classList[action](className);
                    cells[0][1].classList[action](className);
                }
                cells[1][1].classList[action](className);
                !currentNode.isLeafNode && cells[2][1].classList[action](className);
            }
        };

        var toString = function() {
            return this.nodeIndex + this.name;
        };

        var collapse = function() {
            if (this.isLeafNode) {
                return undefined;
            }
            var cacheKey = this.toString();
            var childNodes = this.orgChart.childNodeCache[cacheKey];
            for (var i = 0; i < childNodes.length; i++) {
                (childNodes[i].toString() != cacheKey) && hideAll(this.isCollapsed, childNodes[i]);
            }
            this.isCollapsed = !this.isCollapsed;
            var actionFunc = this.isCollapsed ? "add" : "remove";
            this.htmlContent[1][1].classList[actionFunc](classes["collapse"]);
            this.htmlContent[2][1].classList[actionFunc](classes["collapse"]);
            return this.isCollapsed;
        };

        var hideAll = function(isVisible, nodeObj) {
            var actionFunc = isVisible ? "remove" : "add";
            nodeObj.isHidden = !isVisible;
            nodeObj.htmlContent[1][1].classList.remove(classes["collapse"]);
            nodeObj.htmlContent[2][1].classList.remove(classes["collapse"]);
            for (var i = 0; i < nodeObj.htmlContent.length; i++) {
                for (var j = 0; j < nodeObj.htmlContent[i].length; j++) {
                    nodeObj.htmlContent[i][j].classList[actionFunc](classes["visiblity"]);
                }
            }
        };

        var triggerUserEvent = function(eventType, eventObject, nodeObject) {
            eventObject = eventObject || window.event;
            nodeObject.triggerEvent(eventType, {
                "htmlEventObject": eventObject,
                "nodeObject": nodeObject
            });
        };

        var getPosition = function() {
            var nodeElement = this.htmlContent[1][1];
            return {
                "x": nodeElement.offsetLeft,
                "y": nodeElement.offsetTop
            };
        };

        prototypeObject["setChildNodes"] = setChildNodes;
        prototypeObject["setParentNode"] = setParentNode;
        prototypeObject["getHTMLContent"] = getHTMLContent;
        prototypeObject["getNodeWidth"] = getNodeWidth;
        prototypeObject["setDimensions"] = setDimensions;
        prototypeObject["toString"] = toString;
        prototypeObject["collapse"] = collapse;
        prototypeObject["applyNodeStyle"] = applyNodeStyle;
        prototypeObject["getPosition"] = getPosition;

    })(Node.prototype);

    //Property declarations
    var orgchart = function(inputObj) {
        this.options = {};
        if (inputObj) {
            if (inputObj["options"]) {
                this.options["highlightSubtree"] = inputObj["options"]["highlightSubtree"] || false;
                this.options["allowCollapse"] = false;
                this.options["selectable"] = false;
                this.options["showHoverColors"] = inputObj["options"]["showHoverColors"] || false;
                this.options["editable"] = false;
            }
            this.container = inputObj["container"];
        }
        this.currentLeafNodeIndex = 0;
        this.tableRows = [];
        this.table = createTable(this);
        this.childNodeCache = {}; //Cache of all child nodes in all levels under a node
        //node-select, node-dbclick, node-collapse, node-hover
        this.events = {};
    };

    var getSubtreePosition = function(client, container, subtree, offset) {
        var max = container - subtree - offset;
        var total = client + offset + subtree;
        return total > container ? (client - offset - subtree) : (client + offset);
    };

    var createTable = function(chartObj) {
        var table = createNode("table", {
            "className": classes["chart"],
            "attributes": {
                "cellspacing": "0"
            }
        });
        var tbody = createNode("tbody", {
            "parent": table
        });
        return table;
    };

    var arrangeData = function(chartObj) {
        var rootNode;
        for (var i = 0; i < chartObj.userData.length; i++) {
            var parent = chartObj.userData[i][1];
            var child = chartObj.userData[i][0];
            //setting node index as the 5th element
            chartObj.userData[i][4] = i;
            if (parent == child) {
                rootNode = chartObj.userData[i];
                continue;
            }!chartObj.parentToChildMap[parent] && (chartObj.parentToChildMap[parent] = []);
            chartObj.parentToChildMap[parent].push(chartObj.userData[i]);
        }
        return rootNode;
    };

    var createNodes = function(parentNodeObj, nodeData, level, nodePos) {
        var childNodes = this.parentToChildMap[nodeData[0]] || [];
        var currentNode = new Node({
            "name": nodeData[0],
            "tooltip": nodeData[2] || "",
            "data": nodeData[3] || undefined,
            "parentNode": parentNodeObj,
            "nodePosition": nodePos,
            "orgChart": this,
            "nodeIndex": nodeData[4],
            "userData": nodeData,
            "nodeLevel": nodeData[5]
        });
        var childLevel = level + 1;
        var childNodeObjects = [];
        var leafNodeCount = 0;
        for (var i = 0; i < childNodes.length; i++) {
            if (childNodes.length == 1) {
                var childNodePosition = "ONENODE";
            } else if (i === 0) {
                childNodePosition = "LEFTMOST";
            } else if (i == childNodes.length - 1) {
                childNodePosition = "RIGHTMOST";
            } else {
                childNodePosition = "BETWEEN";
            }
            var childNode = arguments.callee.call(this, currentNode, childNodes[i], childLevel, nodePositions[childNodePosition]);
            leafNodeCount += childNode.leafNodeCount;
            childNodeObjects.push(childNode);
        }
        currentNode.setChildNodes(childNodeObjects);
        !this.depthToLeafNodeMap[currentNode.nodeDepth] && (this.depthToLeafNodeMap[currentNode.nodeDepth] = []);
        var currentMap = this.depthToLeafNodeMap[currentNode.nodeDepth];
        currentNode.isLeafNode && (this.currentLeafNodeIndex = this.currentLeafNodeIndex + 1);
        currentNode.setDimensions(leafNodeCount, this.currentLeafNodeIndex, currentMap);
        currentMap.push(currentNode);
        addToRow(currentNode, this.tableRows);
        addToChildNodeCache(currentNode, this);
        setNodeEvents(currentNode, this);
        return currentNode;
    };

    var addToRow = function(nodeObj, rows) {
        var htmlMatrix = nodeObj.getHTMLContent();
        if (!rows[nodeObj.nodeDepth]) {
            rows[nodeObj.nodeDepth] = [createNode("tr"), createNode("tr"), createNode("tr")];
        }
        var currentArray = rows[nodeObj.nodeDepth];
        for (var i = 0; i < htmlMatrix.length; i++) {
            for (var j = 0; j < htmlMatrix[i].length; j++) {
                currentArray[i].appendChild(htmlMatrix[i][j]);
            }
        }
    };

    var addToChildNodeCache = function(nodeObj, chartObj) {
        var cacheObj = chartObj.childNodeCache;
        var key = nodeObj.toString();
        var currentArray = cacheObj[key];
        if (!currentArray) {
            currentArray = cacheObj[key] = [];
        }
        if (!nodeObj.isLeafNode) {
            nodeObj.childNodes.forEach(function(childNode, index, array) {
                currentArray.push.apply(currentArray, cacheObj[childNode.toString()]);
            });
        }
        currentArray.push(nodeObj);
    };

    /**
     * Internal Event handlers
     */
    var setNodeEvents = function(node, chartObj) {
        node.setEventListener("node-hover", oj.utilities.Events.bindHandler(nodeHoverHandler, chartObj));
    };

    var nodeHoverHandler = function(eventObject) {
        this.triggerEvent("node-hover", eventObject);
    };

    var getComputedCellWidth = function(orgChart) {
        return orgChart.table.rows[0].cells[0].offsetWidth;
    };

    orgchart.prototype = new oj.utilities.Events(["node-hover"]);

    (function(prototypeObject) {
        var setData = function(data) {
            clearChart(this);
            this.userData = data;
            this.rootNodeData = arrangeData(this);
            if (!this.rootNodeData) {
                throw "Root Node missing for the tree";
            }
            this.rootNode = createNodes.call(this, undefined, this.rootNodeData, 0);
        };

        var clearChart = function(chartObj) {
            chartObj.parentToChildMap = {};
            chartObj.depthToLeafNodeMap = {};
            chartObj.childNodeCache = {};
            chartObj.rootNode = undefined;
            chartObj.currentLeafNodeIndex = 0;
            chartObj.tableRows = [];
            chartObj.currentSelectedNode = undefined;
            chartObj.currentClickedNode = undefined;
        };

        var draw = function() {
            var body = this.table.childNodes[0];
            body.innerHTML = "";
            var topRow = createNode("tr", {
                "parent": body
            });
            var totalCellCount = this.currentLeafNodeIndex * 8;
            for (var i = 0; i < totalCellCount; i++) {
                createNode("td", {
                    "parent": topRow
                });
            }
            for (i = 0; i < this.tableRows.length; i++) {
                for (var j = 0; j < this.tableRows[i].length; j++) {
                    body.appendChild(this.tableRows[i][j]);
                }
            }
            this.container && this.container.appendChild(this.table);
        };

        var getSubTree = function(nodeObj, inputObj) {
            var cacheKey = nodeObj.toString();
            var nodes = this.childNodeCache[cacheKey];
            var userData = [];
            if (nodes) {
                for (var i = nodes.length - 1; i >= 0; i--) {
                    var newNodeData = nodes[i]["userData"].slice(0, 2);
                    //setting current node as the root node
                    if (nodes[i] == nodeObj) {
                        newNodeData[1] = newNodeData[0];
                    }
                    userData.push(newNodeData);
                }
                var subTree = new orgchart(inputObj);
                subTree.setData(userData);
                subTree.draw();
                return subTree;
            } else {
                throw "Node not found in tree";
            }
        };

        var getData = function() {
            return this.userData;
        };

        var setVisibility = function(isVisible) {
            this.table.style.display = isVisible ? "block" : "none";
        };

        var setPosition = function(left, top) {
            this.table.style.top = top + "px";
            this.table.style.left = left + "px";
        };

        prototypeObject["setData"] = setData;
        prototypeObject["draw"] = draw;
        prototypeObject["getData"] = getData;
        prototypeObject["getSubTree"] = getSubTree;
        prototypeObject["setVisibility"] = setVisibility;
        prototypeObject["setPosition"] = setPosition;

    })(orgchart.prototype);

    
    return orgchart;
})();
