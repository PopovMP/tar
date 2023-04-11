'use strict'

const {join} = require('node:path')

const {createArchive} = require('../index')

const tarPath = join(__dirname, 'data/holder.tar')
const target  = join(__dirname, 'data/holder')

createArchive(tarPath, target)
