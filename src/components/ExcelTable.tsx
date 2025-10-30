import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

type RowData = Record<string, unknown>

function normalizeVietnamese(str: string): string {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D')
		.toLowerCase()
		.trim()
}

function extractDigits(value: unknown): string {
	const s = String(value ?? '')
	return s.replace(/\D/g, '')
}

function normalizeToLocalTenDigits(digits: string): string {
	// Convert +84 / 84xxxxxxxxx -> 0xxxxxxxxx
	if (digits.startsWith('84') && digits.length === 11) {
		return '0' + digits.slice(2)
	}
	return digits
}

const ALLOWED_PREFIXES = new Set([
	'032', '033', '034', '035', '036', '037', '038', '039', '086', '096', '097', '098', // Viettel
	'081', '082', '083', '084', '085', '088', '091', '094', // VinaPhone
	'070', '076', '077', '078', '079', '089', '090', '093', // MobiFone
	'056', '058', '092', // Vietnamobile
	'059', '099', // Gmobile
])

function isValidVietnamPhone10Digits(value: unknown): boolean {
	const normalized = normalizeToLocalTenDigits(extractDigits(value))
	if (normalized.length !== 10) return false
	const prefix3 = normalized.slice(0, 3)
	return ALLOWED_PREFIXES.has(prefix3)
}

function guessColumnKey(keys: string[], candidates: string[]): string | undefined {
	const normalizedKeys = keys.map((k) => normalizeVietnamese(k))
	for (const c of candidates) {
		const idx = normalizedKeys.findIndex((k) => k.includes(normalizeVietnamese(c)))
		if (idx !== -1) return keys[idx]
	}
	return undefined
}

export function ExcelTable(): JSX.Element {
	const [rows, setRows] = useState<RowData[]>([])
	const [headers, setHeaders] = useState<string[]>([])
	const [onlyValidPhones, setOnlyValidPhones] = useState(true)
	const [searchName, setSearchName] = useState('')
	const [searchPhone, setSearchPhone] = useState('')
	const [activeTab, setActiveTab] = useState<'all' | 'invalid'>('all')
	const [sourceFiles, setSourceFiles] = useState<string[]>([])
	const fileInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		async function loadAll(): Promise<void> {
			try {
				const modules = import.meta.glob('/src/data/**/*.{xlsx,xls}', { eager: true, as: 'url' }) as Record<string, string>
				const fileUrls = Object.values(modules)
				const fileNames = Object.keys(modules).map((p) => p.split('/').pop() || p)
				setSourceFiles(fileNames)
				const allRows: RowData[] = []
				let masterHeaders: string[] | null = null
				for (let i = 0; i < fileUrls.length; i++) {
					const url = fileUrls[i]
					const fileName = fileNames[i]
					const res = await fetch(url)
					const buf = await res.arrayBuffer()
					const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' })
					const firstSheet = workbook.SheetNames[0]
					const sheet = workbook.Sheets[firstSheet]
					const json: RowData[] = XLSX.utils.sheet_to_json(sheet, {
						defval: '',
						raw: false,
						dateNF: 'dd/mm/yyyy hh:mm:ss',
					})
					if (!masterHeaders && json.length > 0) masterHeaders = Object.keys(json[0])
					for (const r of json) allRows.push({ ...r, __file: fileName, __sheet: firstSheet })
				}
				setRows(allRows)
				setHeaders(masterHeaders ?? [])
			} catch (err) {
				console.error('Load excel error', err)
			}
		}
		loadAll()
	}, [])

	function exportDisplayed(): void {
		const exportRows = filteredRows.map(({ __file, __sheet, ...rest }) => rest)
		const ws = XLSX.utils.json_to_sheet(exportRows)
		const wb = XLSX.utils.book_new()
		XLSX.utils.book_append_sheet(wb, ws, 'Data')
		XLSX.writeFile(wb, 'export.xlsx')
	}

	const phoneKey = useMemo(() => {
		return guessColumnKey(headers, ['so dien thoai', 'sdt', 'dien thoai', 'phone'])
	}, [headers])

	const nameKey = useMemo(() => {
		return guessColumnKey(headers, ['ho va ten', 'ten', 'ho ten', 'name'])
	}, [headers])

	const filteredRows = useMemo(() => {
		return rows.filter((row) => {
			const validPhone = isValidVietnamPhone10Digits(row[phoneKey ?? ''])
			const phonePass = activeTab === 'invalid' ? !validPhone : onlyValidPhones ? validPhone : true
			const namePass = searchName
				? normalizeVietnamese(String(row[nameKey ?? ''] ?? '')).includes(normalizeVietnamese(searchName))
				: true
			const phoneDigits = normalizeToLocalTenDigits(extractDigits(row[phoneKey ?? '']))
			const phoneSearchNormalized = normalizeToLocalTenDigits(extractDigits(searchPhone))
			const phoneSearchPass = searchPhone ? phoneDigits.includes(phoneSearchNormalized) : true
			return phonePass && namePass && phoneSearchPass
		})
	}, [rows, onlyValidPhones, activeTab, searchName, searchPhone, phoneKey, nameKey])

	return (
		<div>
			<div className="uploader">
				<span className="hint">Đang dùng các file từ src/data: {sourceFiles.join(', ') || '...'}</span>
			</div>

			{rows.length > 0 && (
				<div className="controls">
					<div className="row">
						<div className="tabs">
							<button className={activeTab === 'all' ? 'tab active' : 'tab'} onClick={() => setActiveTab('all')}>Tất cả</button>
							<button className={activeTab === 'invalid' ? 'tab active' : 'tab'} onClick={() => setActiveTab('invalid')}>SĐT sai</button>
						</div>
						<label className="checkbox">
							<input
								type="checkbox"
								checked={onlyValidPhones}
								onChange={(e) => setOnlyValidPhones(e.target.checked)}
							/>
							<span>Chỉ hiển thị SĐT hợp lệ (10 số + đầu số nhà mạng)</span>
						</label>
						<div className="spacer" />
						<button className="export" onClick={exportDisplayed}>Xuất Excel (dữ liệu đang hiển thị)</button>
						<div className="info">Tổng: {rows.length} • Hiển thị: {filteredRows.length}</div>
					</div>
					<div className="row">
						<input
							placeholder={nameKey ? `Tìm theo ${nameKey}` : 'Tìm theo tên'}
							value={searchName}
							onChange={(e) => setSearchName(e.target.value)}
						/>
						<input
							placeholder={phoneKey ? `Tìm theo ${phoneKey}` : 'Tìm theo SĐT'}
							value={searchPhone}
							onChange={(e) => setSearchPhone(e.target.value)}
						/>
					</div>
				</div>
			)}

			{rows.length > 0 && (
				<div className="table-wrapper">
					<table>
						<thead>
							<tr>
								{headers.map((h) => (
									<th key={h}>{h}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{filteredRows.map((row, idx) => (
								<tr key={idx}>
									{headers.map((h) => {
										const value = row[h]
										if (h === phoneKey) {
											const digitsRaw = extractDigits(value)
											const digits = normalizeToLocalTenDigits(digitsRaw)
											const valid = isValidVietnamPhone10Digits(value)
											return (
												<td key={h} className={valid ? 'ok' : 'not-ok'}>
													{value as string}
													{digits && <span className="digits">({digits})</span>}
												</td>
											)
										}
										return <td key={h}>{String(value ?? '')}</td>
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}



