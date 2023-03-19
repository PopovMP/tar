'use strict'

const {join, dirname} = require('node:path')
const {existsSync, writeFileSync} = require('node:fs')

const {getEntryPaths, getEntryStats} = require('../lib/fs-helper')
const {create} = require('../index')

const archPath     = join(__dirname, 'data/holder.tar')
const dirToArchive = join(__dirname, 'data', 'holder')

createArchive(archPath, dirToArchive)

/**
 * Creates tar from the target
 *
 * @param {string} tarPath - path to the tar file
 * @param {string} target  - path to file or dir to archive
 *
 * @return {void}
 */
function createArchive(tarPath, target)
{
	if (!existsSync(target))
		throw new Error(`cannot open directory: ${target}`)

	const baseDir    = dirname(target)
	const entryPaths = getEntryPaths(target)
	const entryStats = getEntryStats(baseDir, entryPaths)
	const tarball    = create(baseDir, entryStats)

	writeFileSync(tarPath, tarball)
}
