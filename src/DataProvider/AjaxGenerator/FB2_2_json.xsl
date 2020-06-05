<?xml version="1.0"?>
<!DOCTYPE XSL [
	<!ENTITY nohyph "ancestor-or-self::fb:cite|ancestor-or-self::fb:poem|ancestor-or-self::fb:subtitle|ancestor-or-self::fb:epigraph|ancestor-or-self::fb:title">
	<!ENTITY blocklvl "fb:v|fb:p[parent::fb:section or parent::fb:cite or parent::fb:epigraph or parent::fb:annotation]|fb:table|fb:subtitle[parent::fb:section or parent::fb:cite or parent::fb:stanza or parent::fb:annotation]|fb:title|fb:text-author|fb:image[parent::fb:body]">
	<!ENTITY semiblock "fb:cite|fb:epigraph|fb:annotation|fb:poem|fb:stanza">
	<!ENTITY notessec1 "parent::fb:body[@name='notes'] and not(fb:section)">
	<!ENTITY notessec2 "ancestor-or-self::fb:body[@name='notes'] and not(ancestor-or-self::fb:section[parent::fb:body[@name='notes']]/preceding-sibling::fb:section)">
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

	<xsl:template match="fb:sectionend|fb:empty-line|fb:image" mode="getPosition">
		<xsl:param name="pos"/>
		<xsl:value-of select="count(preceding-sibling::*) - $pos"/>
	</xsl:template>

	<xsl:template match="fb:image" mode="checkPos">
		<xsl:call-template name="check_image_descr"><xsl:with-param name="pos"><xsl:apply-templates select="." mode="getPos"/></xsl:with-param></xsl:call-template>
	</xsl:template>

	<xsl:template match="fb:image" mode="getPos">
		<xsl:value-of select="count(preceding-sibling::*)"/>
	</xsl:template>

	<xsl:template name="check_image_descr">
		<xsl:param name="pos"/>
		<xsl:variable name="next" select="following-sibling::*[1]"/>
		<xsl:choose>
			<xsl:when test="name($next) = 'image' or name($next) = 'empty-line'">0</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="next_sectionend">
					<xsl:apply-templates select="following-sibling::fb:sectionend[1]" mode="getPosition">
						<xsl:with-param name="pos" select="$pos"/>
					</xsl:apply-templates>
				</xsl:variable>
				<xsl:variable name="next_image">
					<xsl:apply-templates select="following-sibling::fb:image[1]" mode="getPosition">
						<xsl:with-param name="pos" select="$pos"/>
					</xsl:apply-templates>
				</xsl:variable>
				<xsl:variable name="next_empty_line">
					<xsl:apply-templates select="following-sibling::fb:empty-line[1]" mode="getPosition">
						<xsl:with-param name="pos" select="$pos"/>
					</xsl:apply-templates>
				</xsl:variable>
				<xsl:choose>
					<xsl:when test="$next_sectionend &lt; $next_empty_line or $next_image &lt; $next_empty_line">0</xsl:when>
					<xsl:otherwise>
						<xsl:variable name="image_descr" select="following-sibling::*[position() &lt; $next_empty_line and self::fb:p]"/>
						<xsl:variable name="image_descr_full"><xsl:copy-of select="$image_descr"/></xsl:variable>
						<xsl:choose>
							<xsl:when test="$image_descr and count($image_descr) = $next_empty_line - 1 and string-length($image_descr_full) &lt; 300">1</xsl:when>
							<xsl:otherwise>0</xsl:otherwise>
						</xsl:choose>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="tag2js"><xsl:param name="footnote"/>t:"<xsl:value-of select="name(.)"/>",xp:[<xsl:call-template name="reverse_id"
		/>]<xsl:if test="@id">,i:"<xsl:value-of select="@id"/>"</xsl:if><xsl:if test="@style and @style != ''">,nc:"<xsl:value-of
		select="fb2js:Escape(@style)"/>"</xsl:if><xsl:if test="*|text()">,c:[<xsl:choose>
			<xsl:when test="$footnote &gt; 0"><xsl:apply-templates mode="footnote"/></xsl:when>
			<xsl:otherwise><xsl:apply-templates/></xsl:otherwise>
		</xsl:choose>]</xsl:if><xsl:if test="self::fb:image">,s:"<xsl:value-of select="fb2js:GetImgID(substring-after(@xlink:href,'#'))"
		/>",w:<xsl:value-of select="fb2js:GetImgW(substring-after(@xlink:href,'#'))"/>,h:<xsl:value-of select="fb2js:GetImgH(substring-after(@xlink:href,'#'))"/><xsl:if test="parent::fb:section|parent::fb:body">,op:1</xsl:if></xsl:if></xsl:template>
	<xsl:template match="*">{<xsl:call-template name="tag2js"/>}<xsl:if test="position()!=last()">,</xsl:if></xsl:template>
	<xsl:template match="*" mode="footnote">{<xsl:call-template name="tag2js"><xsl:with-param name="footnote">1</xsl:with-param></xsl:call-template>}<xsl:if test="position()!=last()">,</xsl:if></xsl:template>
	<xsl:template match="&blocklvl;|&semiblock;" mode="footnote">{<xsl:call-template name="tag2js"><xsl:with-param name="footnote">1</xsl:with-param></xsl:call-template>}<xsl:if test="position()!=last()">,</xsl:if></xsl:template>
	<xsl:template match="fb:section" mode="footnote">{t:"footnote",xp:[<xsl:call-template name="reverse_id"
		/>],c:[<xsl:apply-templates mode="footnote"/>]}</xsl:template>

	<xsl:template name="blocklvl">{chars:<xsl:value-of select="string-length(.)"/>,<xsl:call-template name="tag2js"/>}</xsl:template>

	<xsl:template match="&blocklvl;"><xsl:call-template name="blocklvl"/>,<xsl:text >&#010;</xsl:text></xsl:template>

	<xsl:template match="fb:image[parent::fb:section]"><xsl:variable name="image_descr"><xsl:call-template 
		name="check_image_descr"><xsl:with-param name="pos" select="count(preceding-sibling::*)"/></xsl:call-template></xsl:variable><xsl:variable name="imageTag"><xsl:call-template name="blocklvl"/></xsl:variable><xsl:choose>
			<xsl:when test="$image_descr != 0">{chars:0,type:"semiblock",t:"div",op:1,nc:"img_with_subscr",xp:[<xsl:call-template name="reverse_id"
		/>],c:[<xsl:value-of select="$imageTag"/>,</xsl:when><xsl:otherwise><xsl:value-of select="$imageTag"/>,<xsl:text >&#010;</xsl:text></xsl:otherwise>
		</xsl:choose></xsl:template>

	<xsl:template match="fb:empty-line[(parent::fb:section or parent::fb:cite or parent::fb:epigraph or parent::fb:annotation) and not(preceding-sibling::fb:image[1])]"><xsl:call-template name="blocklvl"/>,<xsl:text >&#010;</xsl:text></xsl:template> 
	<xsl:template match="fb:empty-line[preceding-sibling::fb:image[1]]"><xsl:variable 
		name="nnode" select="preceding-sibling::fb:image[1]"/><xsl:variable name="image_descr"><xsl:apply-templates select="$nnode" mode="checkPos"/></xsl:variable><xsl:if test="$image_descr != 0"><xsl:variable name="imagePos"><xsl:apply-templates 
		select="$nnode" mode="getPos"/></xsl:variable><xsl:variable name="prevAll" select="preceding-sibling::*"/><xsl:variable name="noNeedDiv"><xsl:for-each 
		select="$prevAll[position() &gt; $imagePos]"><xsl:if test="name() = 'empty-line'">1</xsl:if></xsl:for-each></xsl:variable><xsl:if test="$noNeedDiv = ''">&#10;{chars:0,cite]},<xsl:text >&#010;</xsl:text></xsl:if></xsl:if><xsl:call-template 
		name="blocklvl"/>,<xsl:text >&#010;</xsl:text></xsl:template>

	<!--fb:empty-line[parent::fb:section or parent::fb:cite or parent::fb:epigraph or parent::fb:annotation]|-->

	<xsl:template match="fb:section[&notessec1;]
	|
	fb:section[&notessec2;]"/>

	<!-- this is a hack for semi-block "cite" tag - ugly, but works for now -->
	<xsl:template match="&semiblock;">
		<xsl:text>{chars:0,type:"semiblock",t:"</xsl:text><xsl:value-of select="name(.)"/>"<xsl:if test="@id">,i:"<xsl:value-of select="@id"/>"</xsl:if>,xp:[<xsl:call-template name="reverse_id"
		/>]<xsl:text>,c:[&#10;</xsl:text>
		<xsl:apply-templates select="*"/>
		<xsl:text>&#10;{chars:0,cite]},&#10;</xsl:text>
	</xsl:template>

	<xsl:template match="fb:section[not(@id = 'litres_trial_promo') and not(parent::fb:body[@name='notes'] and not(fb:section)) and not(ancestor-or-self::fb:body[@name='notes'] and not(ancestor-or-self::fb:section[parent::fb:body[@name='notes']]/preceding-sibling::fb:section))]|fb:body">
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
	<xsl:template match="fb:section[@id = 'litres_trial_promo']">{chars:0,i:"litres_trial_promo",t:"trialPurchase",xp:[<xsl:call-template name="reverse_id"/>]}<xsl:if test="parent::fb:body/following-sibling::fb:body">,</xsl:if><xsl:text >&#010;</xsl:text></xsl:template>
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
				<xsl:otherwise>hr:["<xsl:value-of select="fb2js:Escape(@xlink:href)"/>"]</xsl:otherwise>
		</xsl:choose>
		<xsl:text>}</xsl:text>
		<xsl:if test="position()!=last()">,</xsl:if>
	</xsl:template>
	<xsl:template match="fb:a[not(@type)]" mode="footnote">
		<xsl:apply-templates select="."/>
		<xsl:if test="position()!=last()">,</xsl:if>
	</xsl:template>
	<xsl:template match="fb:a[not(@type)]">
		<xsl:text>{</xsl:text>
		<xsl:call-template name="tag2js"/>
		<xsl:text>,</xsl:text><xsl:choose><xsl:when test="substring(@xlink:href,1,1) = '#'">hr</xsl:when><xsl:otherwise>href</xsl:otherwise></xsl:choose><xsl:text>:["</xsl:text><xsl:value-of select="fb2js:Escape(@xlink:href)"/><xsl:text>"]}</xsl:text>
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
