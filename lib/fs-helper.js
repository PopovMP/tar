'use strict'

const {join, dirname, basename, sep} = require('node:path')
const {opendirSync, statSync} = require('node:fs')

/**
 * @typedef {Object} EntryStats
 *
 * @property {string} name     - entry name
 * @property {string} typeflag - '0' - file, '5' - directory
 * @property {number} size     - entry size
 * @property {number} mtime    - modify time
 * @property {string} prefix   - prefix
 */

/**
 * Takes a path to a file or a directory.
 * Collects stats for all inner files and dirs.
 *
 * @param {string} target - path to file or dir to be archived
 *
 * @return {string[]}
 */
function getEntryPaths(target)
{
	const stats = statSync(target)
	if (stats.isFile())
		return [basename(target)]

	const /** @type {string[]} */ entries = []
	readDirLoop(dirname(target), basename(target), entries)

	return entries
}

/**
 * Loops in the target directory and collects the entries
 *
 * @param {string} baseDir    - parent dir of the dir being archived
 * @param {string} currentDir - path to current dir
 * @param {string[]} acc      - list of all entry names
 *
 * @return {void}
 */
function readDirLoop(baseDir, currentDir, acc)
{
	const /** @type {string[]} */ innerDirs = []
	const /** @type {string[]} */ filePaths = []

	// Look inside current dir
	const /** @type {Dir}    */ dir = opendirSync(join(baseDir, currentDir))
	let   /** @type {Dirent} */ dirent
	while ((dirent = dir.readSync()) !== null) {
		if (dirent.isDirectory())
			innerDirs.push(dirent.name)
		else
			filePaths.push(join(currentDir, dirent.name))
	}
	dir.closeSync()

	// Add current dir
	acc.push(join(currentDir, sep))

	// Add the inner files
	filePaths.sort()
	for (const file of filePaths)
		acc.push(file)

	// Loop over the inner dirs
	innerDirs.sort()
	for (const innerDir of innerDirs)
		readDirLoop(baseDir, join(currentDir, innerDir), acc)
}

/**
 * Gets stats for the given entries
 *
 * @param {string}   baseDir - path to the parent directory
 * @param {string[]} entryPaths
 *
 * @return {EntryStats[]}
 */
function getEntryStats(baseDir, entryPaths)
{
	return entryPaths.map(path => {
		const entryPath      = join(baseDir, path)
		const stats          = statSync(entryPath)
		const {name, prefix} = getNamePrefix(path)
		const isDir          = entryPath.endsWith(sep)

		return {
			name    : name,
			typeflag: isDir ? '5' : '0',
			size    : isDir ? 0 : stats.size,
			mtime   : +stats.mtime,
			prefix  : prefix,
		}
	})
}

/**
 * Splits long paths to name and prefix.
 *
 * @param {string} path
 *
 * @return {{name: string, prefix: string}}
 */
function getNamePrefix(path)
{
	if (path.length <= 100)
		return {name: path, prefix: ''}

	const pathParts = path.split(sep)

	let name   = ''
	let prefix = ''

	for (let i = pathParts.length-1; i >= 0; --i) {
		let part = pathParts[i]

		if (name.length + part.length + 1 > 100) {
			prefix = pathParts.slice(0, i+1).join(sep)
			break
		}

		name = join(part, name)
	}

	return {name, prefix}
}

module.exports = {
	getEntryPaths,
	getEntryStats,
}
