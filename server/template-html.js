module.exports = paths => `
	<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable = no"/>
			<meta name="format-detection" content="telephone=no">
			<title>FB3Reader basic example</title>
		</head>
		<body>
			<div id="reader" class="readerStyles">Loading…</div>
			 ${paths.map((path) => `<script src="${path}"></script>`).join('')}
		</body>
	</html>
`;