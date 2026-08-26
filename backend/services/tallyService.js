exports.isCompatible = xml => Boolean(xml && xml.includes("<ENVELOPE>") && xml.includes("<IMPORTDATA>"));
