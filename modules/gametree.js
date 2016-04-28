(function(root) {

var Board = root.Board

var helper = root.helper
var setting = root.setting

if (typeof require != 'undefined') {
    Board = require('./board')

    helper = require('./helper')
    setting = require('./setting')
}

var context = typeof module != 'undefined' ? module.exports : (window.gametree = {})

context.new = function() {
    return {
        id: helper.getId(),
        nodes: [],
        subtrees: [],
        current: null,
        parent: null,
        collapsed: false
    }
}

context.clone = function(tree, parent) {
    if (!parent) parent = null

    var c = {
        id: tree.id,
        nodes: [],
        subtrees: [],
        current: tree.current,
        parent: parent,
        collapsed: tree.collapsed
    }

    tree.nodes.forEach(function(node) {
        var cn = {}

        for (var key in node) {
            if (key == 'board') continue

            if (Object.prototype.toString.call(node[key]) == '[object Array]') {
                cn[key] = []

                for (var i = 0; i < node[key].length; i++) {
                    cn[key].push(node[key][i])
                }
            } else {
                cn[key] = node[key]
            }
        }

        c.nodes.push(cn)
    })

    tree.subtrees.forEach(function(subtree) {
        c.subtrees.push(context.clone(subtree, c))
    })

    return c
}

context.getRoot = function(tree) {
    while (tree.parent != null) tree = tree.parent
    return tree
}

context.getPlayerName = function(sign, tree, fallback) {
    tree = context.getRoot(tree)
    var color = sign > 0 ? 'B' : 'W'

    if (tree.nodes.length == 0) return fallback

    var result = ''
    if (('P' + color) in tree.nodes[0]) result = tree.nodes[0]['P' + color][0]
    else if ((color + 'T') in tree.nodes[0]) result = tree.nodes[0][color + 'T'][0]

    return result.trim() == '' ? fallback : result
}

context.navigate = function(tree, index, step) {
    if (index + step >= 0 && index + step < tree.nodes.length) {
        return [tree, index + step]
    } else if (index + step < 0 && tree.parent != null) {
        var prev = tree.parent
        var newstep = index + step + 1

        return context.navigate(prev, prev.nodes.length - 1, newstep)
    } else if (index + step >= tree.nodes.length && tree.current != null) {
        var next = tree.subtrees[tree.current]
        var newstep = index + step - tree.nodes.length

        return context.navigate(next, 0, newstep)
    }

    return null
}

context.makeNodeIterator = function(tree, index) {
    var root = context.getRoot(tree)
    var level = context.getLevel(tree, index, root)
    var sections = context.getSection(root, level)
    var j = sections.map(function(x) { return x[0] }).indexOf(tree)

    return {
        navigate: function(step) {
            if (j + step >= 0 && j + step < sections.length) {
                j = j + step
            } else if (j + step >= sections.length) {
                step = j + step - sections.length
                sections = context.getSection(root, ++level)
                j = 0
                if (sections.length != 0) this.navigate(step)
            } else if (j + step < 0) {
                step = j + step + 1
                sections = context.getSection(root, --level)
                j = sections.length - 1
                if (sections.length != 0) this.navigate(step)
            }
        },
        value: function() {
            return j < sections.length && j >= 0 ? sections[j] : null
        },
        next: function() {
            this.navigate(1)
            return this.value()
        },
        prev: function() {
            this.navigate(-1)
            return this.value()
        }
    }
}

context.splitTree = function(tree, index) {
    if (index < 0 || index >= tree.nodes.length - 1) return tree

    var newnodes = tree.nodes.slice(0, index + 1)
    tree.nodes = tree.nodes.slice(index + 1)

    var newtree = context.new()
    newtree.nodes = newnodes
    newtree.subtrees = [tree]
    newtree.parent = tree.parent
    newtree.current = 0
    tree.parent = newtree

    if (newtree.parent)
        newtree.parent.subtrees[newtree.parent.subtrees.indexOf(tree)] = newtree

    return newtree
}

context.reduceTree = function(tree) {
    if (tree.subtrees.length != 1) return tree

    tree.nodes = tree.nodes.concat(tree.subtrees[0].nodes)
    tree.current = tree.subtrees[0].current
    tree.subtrees = tree.subtrees[0].subtrees

    tree.subtrees.forEach(function(subtree) {
        subtree.parent = tree
    })

    return tree
}

context.getHeight = function(tree) {
    var height = 0

    tree.subtrees.forEach(function(subtree) {
        height = Math.max(context.getHeight(subtree), height)
    })

    return height + tree.nodes.length
}

context.getCurrentHeight = function(tree) {
    var height = tree.nodes.length

    if (tree.current != null)
        height += context.getCurrentHeight(tree.subtrees[tree.current])

    return height
}

context.getLevel = function(tree, index) {
    return index + (tree.parent ? context.getLevel(tree.parent, tree.parent.nodes.length) : 0)
}

context.getSection = function(tree, level) {
    if (level < 0) return []
    if (level < tree.nodes.length) return [[tree, level]]

    var sections = []

    tree.subtrees.forEach(function(subtree) {
        sections = sections.concat(context.getSection(subtree, level - tree.nodes.length))
    })

    return sections
}

context.getWidth = function(y, matrix) {
    var keys = Object.keys(new Int8Array(10)).map(function(i) {
        return parseFloat(i) + y - 4
    }).filter(function(i) { return i >= 0 && i < matrix.length })

    var padding = Math.min.apply(null, keys.map(function(i) {
        for (var j = 0; j < matrix[i].length; j++)
            if (matrix[i][j] != null) return j
        return 0
    }))

    var width = Math.max.apply(null, keys.map(function(i) {
        return matrix[i].length
    })) - padding

    return [width, padding]
}

context.tree2matrixdict = function(tree, matrix, dict, xshift, yshift) {
    if (!matrix) matrix = Array.apply(null, new Array(context.getHeight(tree))).map(function() { return [] });
    if (!dict) dict = {}
    if (!xshift) xshift = 0
    if (!yshift) yshift = 0

    var hasCollisions = true
    while (hasCollisions) {
        hasCollisions = false

        for (var y = 0; y < Math.min(tree.nodes.length + 1, matrix.length - yshift); y++) {
            if (xshift >= matrix[yshift + y].length) continue

            hasCollisions = true
            xshift++
            break
        }
    }

    for (var y = 0; y < tree.nodes.length; y++) {
        while (xshift >= matrix[yshift + y].length) {
            matrix[yshift + y].push(null)
        }

        matrix[yshift + y][xshift] = [tree, y]
        dict[tree.id + '-' + y] = [xshift, yshift + y]
    }

    if (!tree.collapsed) {
        for (var k = 0; k < tree.subtrees.length; k++) {
            var subtree = tree.subtrees[k]
            context.tree2matrixdict(subtree, matrix, dict, xshift, yshift + tree.nodes.length)
        }
    }

    return [matrix, dict]
}

context.onCurrentTrack = function(tree) {
    return !tree.parent || tree.parent.subtrees[tree.parent.current] == tree && context.onCurrentTrack(tree.parent)
}

context.onMainTrack = function(tree) {
    return !tree.parent || tree.parent.subtrees[0] == tree && context.onMainTrack(tree.parent)
}

context.matrixdict2graph = function(matrixdict) {
    var matrix = matrixdict[0]
    var dict = matrixdict[1]
    var graph = { nodes: [], edges: [] }
    var currentTrack = []
    var notCurrentTrack = []
    var width = Math.max.apply(null, matrix.map(function(x) { return x.length }))
    var gridSize = setting.get('graph.grid_size')

    for (var y = 0; y < matrix.length; y++) {
        for (var x = 0; x < width; x++) {
            if (!matrix[y][x]) continue

            var tree = matrix[y][x][0]
            var index = matrix[y][x][1]
            var id = tree.id + '-' + index
            var node = {
                id: id,
                x: x * gridSize,
                y: y * gridSize,
                size: setting.get('graph.node_size'),
                data: matrix[y][x],
                originalColor: setting.get('graph.node_color')
            }
            var commentproperties = setting.get('sgf.comment_properties')

            if (commentproperties.some(function(x) { return x in tree.nodes[index] }))
                node.originalColor = setting.get('graph.node_comment_color')
            if ('HO' in tree.nodes[index])
                node.originalColor = setting.get('graph.node_bookmark_color')

            // Show passes as squares
            if ('B' in tree.nodes[index] && tree.nodes[index].B[0] == ''
            || 'W' in tree.nodes[index] && tree.nodes[index].W[0] == '') {
                node.type = 'square'
                node.size++
            }

            if (currentTrack.indexOf(tree.id) != -1) {
                node.color = node.originalColor
            } else if (notCurrentTrack.indexOf(tree.id) == -1) {
                if (context.onCurrentTrack(tree)) {
                    currentTrack.push(tree.id)
                    node.color = node.originalColor
                } else {
                    notCurrentTrack.push(tree.id)
                }
            }

            if (tree.collapsed && tree.subtrees.length > 0 && index == tree.nodes.length - 1)
                node.color = node.originalColor = setting.get('graph.node_collapsed_color')

            graph.nodes.push(node)

            var prev = context.navigate(tree, index, -1)
            if (!prev) continue
            var prevId = prev[0].id + '-' + prev[1]
            var prevPos = dict[prevId]

            if (prevPos[0] != x) {
                graph.nodes.push({
                    id: id + '-h',
                    x: (x - 1) * gridSize,
                    y: (y - 1) * gridSize,
                    size: 0
                })

                graph.edges.push({
                    id: id + '-e1',
                    source: id,
                    target: id + '-h'
                })

                graph.edges.push({
                    id: id + '-e2',
                    source: id + '-h',
                    target: prevId
                })
            } else {
                graph.edges.push({
                    id: id + '-e1',
                    source: id,
                    target: prevId
                })
            }
        }
    }

    return graph
}

context.addBoard = function(tree, index, baseboard) {
    if (isNaN(index)) index = 0
    if (index >= tree.nodes.length) return tree

    var node = tree.nodes[index]
    var vertex = null
    var board = null

    if (!baseboard) {
        var prev = context.navigate(tree, index, -1)

        if (!prev) {
            var size = 'SZ' in node ? node.SZ[0].toInt() : 19
            baseboard = new Board(size)
        } else {
            var prevNode = prev[0].nodes[prev[1]]

            if (!prevNode.board) context.addBoard(prev[0], prev[1])
            baseboard = prevNode.board
        }
    }

    if ('B' in node) {
        vertex = sgf.point2vertex(node.B[0])
        board = baseboard.makeMove(1, vertex)
    } else if ('W' in node) {
        vertex = sgf.point2vertex(node.W[0])
        board = baseboard.makeMove(-1, vertex)
    }

    if (!board) board = baseboard.clone()

    var ids = ['AW', 'AE', 'AB']

    for (var i = 0; i < ids.length; i++) {
        if (!(ids[i] in node)) continue

        node[ids[i]].forEach(function(value) {
            sgf.compressed2list(value).forEach(function(vertex) {
                board.arrangement[vertex] = i - 1
            })
        })
    }

    if (vertex != null) {
        board.markups[vertex] = ['point', 0, '']
    }

    var ids = ['CR', 'MA', 'SQ', 'TR']
    var classes = ['circle', 'cross', 'square', 'triangle']

    for (var i = 0; i < ids.length; i++) {
        if (!(ids[i] in node)) continue

        node[ids[i]].forEach(function(value) {
            sgf.compressed2list(value).forEach(function(vertex) {
                board.markups[vertex] = [classes[i], 0, '']
            })
        })
    }

    if ('LB' in node) {
        node.LB.forEach(function(composed) {
            var sep = composed.indexOf(':')
            var point = composed.slice(0, sep)
            var label = composed.slice(sep + 1).replace(/\s+/, ' ')
            board.markups[sgf.point2vertex(point)] = ['label', 0, label]
        })
    }

    if ('LN' in node) {
        node.LN.forEach(function(composed) {
            var sep = composed.indexOf(':')
            var p1 = composed.slice(0, sep)
            var p2 = composed.slice(sep + 1)
            board.lines.push([sgf.point2vertex(p1), sgf.point2vertex(p2), false])
        })
    }

    if ('AR' in node) {
        node.AR.forEach(function(composed) {
            var sep = composed.indexOf(':')
            var p1 = composed.slice(0, sep)
            var p2 = composed.slice(sep + 1)
            board.lines.push([sgf.point2vertex(p1), sgf.point2vertex(p2), true])
        })
    }

    node.board = board

    // Add variation overlays

    var addOverlay = function(node) {
        var v, sign

        if ('B' in node) {
            v = sgf.point2vertex(node.B[0])
            sign = 1
        } else if ('W' in node) {
            v = sgf.point2vertex(node.W[0])
            sign = -1
        } else {
            return
        }

        if (v in board.markups) board.markups[v][1] = sign
        else board.markups[v] = ['', sign, '']
    }

    if (index == tree.nodes.length - 1 && tree.subtrees.length > 0) {
        tree.subtrees.forEach(function(subtree) {
            if (subtree.nodes.length == 0) return
            addOverlay(subtree.nodes[0])
        })
    } else if (index < tree.nodes.length - 1) {
        addOverlay(tree.nodes[index + 1])
    }

    return tree
}

context.getJson = function(tree) {
    return JSON.stringify(tree, function(name, val) {
        var list = ['id', 'board', 'parent', 'collapsed', 'current']
        return list.indexOf(name) >= 0 ? undefined : val
    })
}

context.fromJson = function(json) {
    var addInformation = function(tree) {
        tree.id = helper.getId()
        tree.collapsed = false

        if (tree.subtrees.length > 0) tree.current = 0

        for (var i = 0; i < tree.subtrees.length; i++) {
            tree.subtrees[i].parent = tree
            addInformation(tree.subtrees[i])
        }

        return tree
    }

    var tree = JSON.parse(json)
    tree.parent = null
    return addInformation(tree)
}

context.getHash = function(tree) {
    var sgf = typeof require == 'undefined' ? root.sgf : require('./sgf')
    return helper.hash(sgf.stringify(tree))
}

}).call(null, typeof module != 'undefined' ? module : window)
