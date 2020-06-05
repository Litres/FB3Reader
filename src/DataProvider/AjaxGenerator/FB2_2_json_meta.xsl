<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xlink="http://www.w3.org/1999/xlink"
	xmlns:fb="http://www.gribuser.ru/xml/fictionbook/2.0"
	xmlns:fb2js="FB2JS">
	<xsl:output method="text" encoding="UTF-8"/>
	<xsl:strip-space elements="*"/>
	<xsl:template match="/*">
	<xsl:text>Meta:{Title:"</xsl:text><xsl:value-of select="fb2js:Escape(/fb:FictionBook/fb:description/fb:title-info/fb:book-title,0)"/>",UUID:"<xsl:value-of select="/fb:FictionBook/fb:description/fb:document-info/fb:id"/>",version:"1.0",Authors:[<xsl:for-each select="/fb:FictionBook/fb:description/fb:title-info/fb:author">{First:"<xsl:value-of select="fb2js:Escape(fb:first-name,0)"/>",Last:"<xsl:value-of select="fb2js:Escape(fb:last-name,0)"
	/>",Middle:"<xsl:value-of select="fb2js:Escape(fb:middle-name,0)"/>"}<xsl:if test="following-sibling::fb:author">,</xsl:if></xsl:for-each><xsl:text>]}</xsl:text>
	</xsl:template>
</xsl:stylesheet>