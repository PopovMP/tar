'use strict'

const {equal}        = require('node:assert')
const {join} = require('node:path')

const {getEntryPaths} = require('../index')

const target = join(__dirname, 'data/holder')
const entryPaths = getEntryPaths(target).map(p => p.replaceAll('\\', '/'))

equal(entryPaths[0], 'holder/')
equal(entryPaths[1], 'holder/hello.txt')
equal(entryPaths[2], 'holder/stuff/')
equal(entryPaths[3], 'holder/stuff/info.txt')
equal(entryPaths[4], 'holder/stuff/things/')
equal(entryPaths[5], 'holder/stuff/things/foo.txt')
