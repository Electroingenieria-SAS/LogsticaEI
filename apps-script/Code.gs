const ROOT_FOLDER_NAME = 'EVIDENCIAS_TRAZABILIDAD_LOGISTICA';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
    const yearFolder = getOrCreateChildFolder_(root, String(new Date().getFullYear()));
    const monthFolder = getOrCreateChildFolder_(yearFolder, monthName_());
    const processFolder = getOrCreateChildFolder_(monthFolder, cleanName_(payload.processName || payload.processKey || 'Proceso sin definir'));
    const ownerFolder = getOrCreateChildFolder_(processFolder, cleanName_(payload.ownerName || payload.ownerRole || 'Responsable sin definir'));
    const orderFolder = getOrCreateChildFolder_(ownerFolder, cleanName_(payload.orderNumber || payload.caseId || 'Pedido sin definir'));
    const caseFolder = getOrCreateChildFolder_(orderFolder, cleanName_(payload.caseId || 'Caso sin definir'));

    const bytes = Utilities.base64Decode(payload.base64 || '');
    const safeName = cleanName_(payload.fileName || `archivo_${Date.now()}`);
    const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', safeName);
    const file = caseFolder.createFile(blob);
    file.setDescription(`Caso: ${payload.caseId || ''} · Pedido: ${payload.orderNumber || ''} · Proceso: ${payload.processName || ''} · Responsable: ${payload.ownerName || ''}`);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        fileId: file.getId(),
        url: file.getUrl(),
        name: file.getName(),
        folder: caseFolder.getName(),
        folderPath: `${ROOT_FOLDER_NAME}/${yearFolder.getName()}/${monthFolder.getName()}/${processFolder.getName()}/${ownerFolder.getName()}/${orderFolder.getName()}/${caseFolder.getName()}`
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
    .substring(0, 90) || 'SIN_DATO';
}

function monthName_() {
  const d = new Date();
  const names = ['01 Enero','02 Febrero','03 Marzo','04 Abril','05 Mayo','06 Junio','07 Julio','08 Agosto','09 Septiembre','10 Octubre','11 Noviembre','12 Diciembre'];
  return names[d.getMonth()];
}
