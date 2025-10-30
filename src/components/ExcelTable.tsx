import React, { useMemo, useRef, useState } from 'react'
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
	const [sheetName, setSheetName] = useState<string>('')
	const fileInputRef = useRef<HTMLInputElement>(null)

	function handleFile(file: File): void {
		const reader = new FileReader()
		reader.onload = (e) => {
			const data = new Uint8Array(e.target?.result as ArrayBuffer)
			const workbook = XLSX.read(data, { type: 'array' })
			const firstSheet = workbook.SheetNames[0]
			const sheet = workbook.Sheets[firstSheet]
			const json: RowData[] = XLSX.utils.sheet_to_json(sheet, {
				defval: '',
				raw: false,
				dateNF: 'dd/mm/yyyy hh:mm:ss',
			})
			const keys = json.length > 0 ? Object.keys(json[0]) : []
			setSheetName(firstSheet)
			setRows(json)
			setHeaders(keys)
		}
		reader.readAsArrayBuffer(file)
	}

	function onDrop(e: React.DragEvent<HTMLDivElement>): void {
		e.preventDefault()
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFile(e.dataTransfer.files[0])
		}
	}

	function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
		const file = e.target.files?.[0]
		if (file) handleFile(file)
	}

	const phoneKey = useMemo(() => {
		return guessColumnKey(headers, ['so dien thoai', 'sdt', 'dien thoai', 'phone'])
	}, [headers])

	const nameKey = useMemo(() => {
		return guessColumnKey(headers, ['ho va ten', 'ten', 'ho ten', 'name'])
	}, [headers])

	const filteredRows = useMemo(() => {
		return rows.filter((row) => {
			const phonePass = onlyValidPhones ? isValidVietnamPhone10Digits(row[phoneKey ?? '']) : true
			const namePass = searchName
				? normalizeVietnamese(String(row[nameKey ?? ''] ?? '')).includes(normalizeVietnamese(searchName))
				: true
			const phoneDigits = normalizeToLocalTenDigits(extractDigits(row[phoneKey ?? '']))
			const phoneSearchNormalized = normalizeToLocalTenDigits(extractDigits(searchPhone))
			const phoneSearchPass = searchPhone ? phoneDigits.includes(phoneSearchNormalized) : true
			return phonePass && namePass && phoneSearchPass
		})
	}, [rows, onlyValidPhones, searchName, searchPhone, phoneKey, nameKey])

	return (
		<div>
			<div className="uploader" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
				<input
					ref={fileInputRef}
					id="file"
					type="file"
					accept=".xlsx,.xls"
					onChange={onFileChange}
					style={{ display: 'none' }}
				/>
				<button onClick={() => fileInputRef.current?.click()}>Chọn file Excel</button>
				<span className="hint">hoặc kéo thả file vào đây</span>
			</div>

			{rows.length > 0 && (
				<div className="controls">
					<div className="row">
						<label className="checkbox">
							<input
								type="checkbox"
								checked={onlyValidPhones}
								onChange={(e) => setOnlyValidPhones(e.target.checked)}
							/>
							<span>Chỉ hiển thị SĐT hợp lệ (10 số + đầu số nhà mạng)</span>
						</label>
						<div className="spacer" />
						<div className="info">Sheet: <b>{sheetName}</b> • Tổng: {rows.length} • Hiển thị: {filteredRows.length}</div>
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



