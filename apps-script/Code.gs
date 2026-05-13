const ROOT_FOLDER_NAME = 'EVIDENCIAS_LOGISTICA_ELECTROINGENIERIA';

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload.base64) throw new Error('No llegó archivo en base64.');

    const now = new Date();
    const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
    const yearFolder = getOrCreateChildFolder_(root, String(now.getFullYear()));
    const monthFolder = getOrCreateChildFolder_(yearFolder, monthName_(now));
    const processFolder = getOrCreateChildFolder_(monthFolder, cleanName_(payload.processName || payload.processKey || 'Proceso sin definir'));
    const ownerFolder = getOrCreateChildFolder_(processFolder, cleanName_(payload.ownerName || payload.ownerRole || 'Responsable sin definir'));
    const orderFolder = getOrCreateChildFolder_(ownerFolder, cleanName_(payload.orderNumber || payload.caseId || 'Pedido sin definir'));
    const caseFolder = getOrCreateChildFolder_(orderFolder, cleanName_(payload.caseId || 'Caso sin definir'));
    const typeFolder = getOrCreateChildFolder_(caseFolder, cleanName_(payload.evidenceType || 'Evidencias'));

    const bytes = Utilities.base64Decode(payload.base64 || '');
    const safeName = cleanName_(`${timestamp_(now)}_${payload.fileName || 'archivo'}`);
    const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', safeName);
    const file = typeFolder.createFile(blob);
    file.setDescription([
      `Caso: ${payload.caseId || ''}`,
      `Pedido: ${payload.orderNumber || ''}`,
      `Cliente: ${payload.clientName || ''}`,
      `Proceso: ${payload.processName || payload.processKey || ''}`,
      `Tipo evidencia: ${payload.evidenceType || ''}`,
      `Corte: ${payload.cutId || ''}`,
      `Responsable: ${payload.ownerName || ''}`,
      `Rol: ${payload.ownerRole || ''}`,
      `Cargado: ${payload.uploadedAt || now.toISOString()}`,
      `Archivo original: ${payload.originalFileName || ''}`
    ].join(' · '));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json_({
      ok: true,
      fileId: file.getId(),
      url: file.getUrl(),
      name: file.getName(),
      folder: typeFolder.getName(),
      folderPath: [ROOT_FOLDER_NAME, yearFolder.getName(), monthFolder.getName(), processFolder.getName(), ownerFolder.getName(), orderFolder.getName(), caseFolder.getName(), typeFolder.getName()].join('/'),
      uploadedAt: payload.uploadedAt || now.toISOString()
    });
  } catch (error) {
    return json_({ ok: false, error: error && error.message ? error.message : String(error) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'Drive evidencias logística', root: ROOT_FOLDER_NAME });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function cleanName_(value) {
  return String(value || 'SIN_DATO')
    .replace(/[\/\\:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120) || 'SIN_DATO';
}

function monthName_(date) {
  const d = date || new Date();
  const names = ['01 Enero','02 Febrero','03 Marzo','04 Abril','05 Mayo','06 Junio','07 Julio','08 Agosto','09 Septiembre','10 Octubre','11 Noviembre','12 Diciembre'];
  return names[d.getMonth()];
}

function timestamp_(date) {
  const d = date || new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Bogota', 'yyyyMMdd_HHmmss');
}
