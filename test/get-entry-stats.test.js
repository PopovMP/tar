'use strict'

const {equal}        = require('assert')
const {join} = require('path')

const {getEntryPaths, getEntryStats} = require('../index')

const target = join(__dirname, 'data/holder')
const entryPaths = getEntryPaths(target)

const baseDir = join(__dirname, 'data')
const entryStats = getEntryStats(baseDir, entryPaths)

const stuff = entryStats[2]
equal(stuff.name.replaceAll('\\', '/'), 'holder/stuff/')
equal(stuff.typeflag, '5')
equal(stuff.size,      0 )

const foo = entryStats[5]
equal(foo.name.replaceAll('\\', '/'), 'holder/stuff/things/foo.txt')
equal(foo.typeflag, '0')
equal(foo.size,     23 )
