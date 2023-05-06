'use strict'

const {join} = require('path')
const {writeFileSync} = require('fs')

const {getEntryPaths, getEntryStats, create} = require('../index')

const target = join(__dirname, 'data/holder')
const entryPaths = getEntryPaths(target)

const baseDir = join(__dirname, 'data')
const entryStats = getEntryStats(baseDir, entryPaths)

const tarPath = join(__dirname, 'data/holder.tar')
const tar = create(baseDir, entryStats)

writeFileSync(tarPath, tar)
