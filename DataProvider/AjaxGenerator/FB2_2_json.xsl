<?xml version="1.0"?>
<!DOCTYPE XSL [
	<!ENTITY nohyph "ancestor-or-self::fb:cite|ancestor-or-self::fb:poem|ancestor-or-self::fb:subtitle|ancestor-or-self::fb:epigraph|ancestor-or-self::fb:title">
	<!ENTITY blocklvl "fb:image[parent::fb:section or parent::fb:body]|fb:v|fb:p[parent::fb:section or parent::fb:cite or parent::fb:epigraph or parent::fb:annotation]|fb:table|fb:subtitle[parent::fb:section or parent::fb:cite or parent::fb:stanza or parent::fb:annotation]|fb:title|fb:empty-line[parent::fb:section or parent::fb:cite or parent::fb:epigraph or parent::fb:annotation]|fb:text-author">
	<!ENTITY semiblock "fb:cite|fb:epigraph|fb:annotation|fb:poem|fb:stanza">
]>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xlink="http://www.w3.org/1999/xlink"
	xmlns:fb="http://www.gribuser.ru/xml/fictionbook/2.0"
	xmlns:fb2js="FB2JS">
	<xsl:strip-space elements="*"/>
	<xsl:output method="text" encoding="UTF-8"/>
	<xsl:key name="note-link" match="fb:section" use="@id"/>
	<xsl:template match="/*">
<!--		<![CDATA[<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
		<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en"><head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
		<title>JSONBOOK</title></head><body>
		<script language="JavaScript1.2" type="text/javascript">
		var start = new Date().getTime();
		var BenchReaders = [];
		var Base = 0;function c(val){
			if(window.parent && window.parent.JSONFB2Readers){
				window.parent.JSONFB2Readers[0].Consume(Base++,val)
			} else {
				BenchReaders[Base++] = val;
			}
		}
]]>-->
		<xsl:apply-templates select="fb:body"/>
<!--	<![CDATA[var elapsed = new Date().getTime() - start;document.write(elapsed+'ms to load data');</script></body></html>]]>-->
	</xsl:template>

	<xsl:template name="tag2js"><xsl:param name="footnote"/>t:"<xsl:value-of select="name(.)"/>",xp:[<xsl:call-template name="reverse_id"
		/>]<xsl:if test="@id">,i:"<xsl:value-of select="@id"/>"</xsl:if><xsl:if test="@style and @style != ''">,nc:"<xsl:value-of
		select="@style"/>"</xsl:if><xsl:if test="*|text()">,c:[<xsl:choose>
			<xsl:when test="$footnote &gt; 0"><xsl:apply-templates mode="footnote"/></xsl:when>
			<xsl:otherwise><xsl:apply-templates/></xsl:otherwise>
		</xsl:choose>]</xsl:if><xsl:if test="self::fb:image">,s:"<xsl:value-of select="fb2js:GetImgID(substring-after(@xlink:href,'#'))"
		/>",w:<xsl:value-of select="fb2js:GetImgW(substring-after(@xlink:href,'#'))"/>,h:<xsl:value-of select="fb2js:GetImgH(substring-after(@xlink:href,'#'))"/></xsl:if></xsl:template>
	<xsl:template match="*">{<xsl:call-template name="tag2js"/>}<xsl:if test="position()!=last()">,</xsl:if></xsl:template>
	<xsl:template match="*" mode="footnote">{<xsl:call-template name="tag2js"><xsl:with-param name="footnote">1</xsl:with-param></xsl:call-template>}<xsl:if test="position()!=last()">,</xsl:if></xsl:template>
	<xsl:template match="&blocklvl;|&semiblock;" mode="footnote">{<xsl:call-template name="tag2js"><xsl:with-param name="footnote">1</xsl:with-param></xsl:call-template>}<xsl:if test="position()!=last()">,</xsl:if></xsl:template>
	<xsl:template match="fb:section" mode="footnote">{t:"footnote",xp:[<xsl:call-template name="reverse_id"
		/>],c:[<xsl:apply-templates mode="footnote"/>]}</xsl:template>

	<xsl:template match="&blocklvl;">{chars:<xsl:value-of select="string-length(.)"/>,<xsl:call-template name="tag2js"/>},<xsl:text >&#010;</xsl:text></xsl:template>

	<xsl:template match="fb:section[parent::fb:body[@name='notes'] and not(fb:section)]
	|
	fb:section[ancestor-or-self::fb:body[@name='notes'] and not(ancestor-or-self::fb:section[parent::fb:body[@name='notes']]/preceding-sibling::fb:section)]"/>

	<!-- this is a hack for semi-block "cite" tag - ugly, but works for now -->
	<xsl:template match="&semiblock;">
		<xsl:text>{chars:0,type:"semiblock",t:"</xsl:text><xsl:value-of select="name(.)"/>"<xsl:if test="@id">,i:"<xsl:value-of select="@id"/>"</xsl:if>xp:[<xsl:call-template name="reverse_id"
		/>],<xsl:text>,c:[&#10;</xsl:text>
		<xsl:apply-templates select="*"/>
		<xsl:text>&#10;{chars:0,cite]},&#10;</xsl:text>
	</xsl:template>

	<xsl:template match="fb:section|fb:body">
		<xsl:text>&gt;&gt;&gt;</xsl:text>
		<xsl:if test="@id"> [<xsl:value-of select="@id"/>]</xsl:if>
		<xsl:if test="not(@name = 'notes')">
			<xsl:for-each select="fb:title">
				<xsl:for-each select="fb:p">
					<xsl:value-of select="fb2js:Escape(.)"/><xsl:if test="position()!=last()"><xsl:text> </xsl:text></xsl:if>
				</xsl:for-each>
			</xsl:for-each>
		</xsl:if>
		<xsl:text>&#10;</xsl:text>
	<xsl:apply-templates select="*"/>
	<xsl:text>&lt;&lt;&lt;&#10;</xsl:text>
	</xsl:template>
	<xsl:template match="fb:title[parent::fb:body[@name='notes']]"/>
	<xsl:template match="fb:a[@type = 'note']">
		<xsl:variable name="NoteID"><xsl:value-of select="substring-after(@xlink:href,'#')"/></xsl:variable>
		<xsl:text>{</xsl:text>
		<xsl:call-template name="tag2js"/>
		<xsl:text>,</xsl:text>
		<xsl:choose>
			<xsl:when test="key('note-link',$NoteID)/parent::fb:body or
				not(key('note-link',$NoteID)/ancestor-or-self::fb:section[parent::fb:body]/preceding-sibling::fb:section)"
					>f:<xsl:apply-templates select="key('note-link',$NoteID)" mode="footnote"/></xsl:when>
				<xsl:otherwise>href:"<xsl:value-of select="substring-after(@xlink:href,'#')"/>"</xsl:otherwise>
		</xsl:choose>
		<xsl:text>}</xsl:text>
		<xsl:if test="position()!=last()">,</xsl:if>
	</xsl:template>
	<xsl:template match="fb:a[ not(@type) and substring(@xlink:href,1,1) = '#']">
		<xsl:text>{</xsl:text>
		<xsl:call-template name="tag2js"/>
		<xsl:text>,hr:["</xsl:text><xsl:value-of select="@xlink:href"/><xsl:text>"]}</xsl:text>
		<xsl:if test="position()!=last()">,</xsl:if>
	</xsl:template>

<xsl:template match="text()" mode="footnote"><xsl:apply-templates select="."/><xsl:if test="position()!=last()">,</xsl:if></xsl:template>
<xsl:template match="text()">
	<xsl:variable name="NeedHyph">
		<xsl:choose>
			<xsl:when test="&nohyph;">0</xsl:when>
			<xsl:otherwise>1</xsl:otherwise>
		</xsl:choose>
	</xsl:variable>
	<xsl:text>"</xsl:text>
	<xsl:value-of select="fb2js:SplitString(.,$NeedHyph)" />
	<xsl:text>"</xsl:text>
	<xsl:if test="position()!=last()">,</xsl:if>
</xsl:template>

	<xsl:template name="reverse_id">
    <xsl:param name="node" select="."/>
    <xsl:for-each select="$node">
      <xsl:if test="name(..) != 'FictionBook'">
        <xsl:call-template name="reverse_id">
          <xsl:with-param name="node" select=".."/>
        </xsl:call-template>,</xsl:if>
    </xsl:for-each><xsl:value-of select="count($node/preceding-sibling::*|$node/preceding-sibling::text())+1"/>
	</xsl:template>
</xsl:stylesheet>
