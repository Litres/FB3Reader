#!/usr/bin/perl
use strict;
use XPortal::Hyphenate; # HyphString used, may remove and replace with something
use XPortal::Settings;  # TMPPath used, you can use your path and remove this

use strict;
use XML::LibXSLT;
use XML::LibXML;
use utf8;
use Encode;
use Image::Size;
use MIME::Base64;

my $FBURI='http://www.gribuser.ru/xml/fictionbook/2.0';
my $PartLimit = 10000;
my $Styles=qr/a|style|strong|emphasis|sub|sup|strikethrough|code/;

my $XML = $ARGV[0];
my $XSL = $ARGV[1];
my $MetaXSL = $ARGV[2];
my $Out = $ARGV[3];

#my $XML = 'C:/Work/FictionHub/tmp/Vyigotskiyi_vyi_L._Psihologiya_Iskusstva.fb2';
#my $XSL = 'C:/Work/FictionHub/xsl/convert/FB2_2_json.xsl';
#my $MetaXSL = 'C:/Work/FictionHub/xsl/convert/FB2_2_json_meta.xsl';
#my $Out = 'C:\Work\FictionHub\cgi\static\out.html';

unless ($Out){
	print "fb2json converter. Usage:\nfb2json.pl <srcfile.fb2> <stylesheet.xsl> <meta-stylesheet.xsl> <out>\n";
	exit(0);
}

my %DocumentImages;

my %HyphCache;
sub SplitString{
	my $Esc=shift || return;
	my $NeedHyph = shift() .' ';
	$NeedHyph *= 1;
	my $SRC = $Esc = EscString($Esc);
	if ($NeedHyph){
		$Esc = $HyphCache{$SRC} || XPortal::Hyphenate::HyphString($Esc);
	}
	$Esc =~ s/\s+/ ','/g;
	$Esc =~ s/('|^) ','/$1 /g;
	$Esc =~ s/'',|,''|','$//g;
	if ($NeedHyph){
		$HyphCache{$SRC} = $Esc;
		$Esc =~ s/\x{AD}/','\x{AD}/g;	# Full version
#		$Esc =~ s/\x{AD}/','/g; 			# Compact version
	}
	return $Esc;
}

sub EscString{
	my $Esc=shift || return;
	$Esc = Encode::decode_utf8($Esc." "); # Hack to get live string from LibXML
	$Esc =~ s/(['\\])/\\$1/g;
	$Esc =~ s/\r?\n\r?/ /g;
	$Esc =~ s/ $//;
	return $Esc;
}

my $TmpXML;
if (-f $XML) {
	use File::Basename;

	open XML, $XML or die "Cannot open file $XML";
	my $XMLData = Encode::decode_utf8(join '', (<XML>));
	close XML;

	$XMLData =~ s/([\s>])([^\s<>]+)(<a\s+[^>]*?type="note"[^>]*?>[^<]{1,10}<\/a>[,\.\?"'“”«»‘’;:\)…\/]?)/$1.HypheNOBR($2,$3)/ges;
	$XMLData =~ s/(\S)(<\/$Styles>)(\s+)/$1 $2/gi;

	$TmpXML = $XPortal::Settings::TMPPath . "/". $$ . "_" . basename($XML) . ".xml";

	open TMPXML, ">", $TmpXML or die "Cannot open tmp file $TmpXML";
	print TMPXML Encode::encode_utf8($XMLData);
	close TMPXML;

	$XML = $TmpXML;
} else {
	warn "'$XML' not found";
	exit 0;
}

sub HypheNOBR {
	my ($Word, $NOBRCharSeq) = @_;

#	$Word = EscString($Word);
	my $Esc = $HyphCache{$Word} || XPortal::Hyphenate::HyphString($Word);

	unless ($Esc =~ s/\xAD?([^\xAD]+)$/<nobr>$1/s) {
		$Esc = '<nobr>'.$Esc;
	}

	return $Esc . $NOBRCharSeq . '</nobr>';
}

my $xslt = XML::LibXSLT->new();
$xslt->register_function ('FB2JS','SplitString',\&SplitString);
$xslt->register_function ('FB2JS','Escape',\&EscString);
$xslt->register_function ('FB2JS','GetImgW',\&GetImgW);
$xslt->register_function ('FB2JS','GetImgH',\&GetImgH);
$xslt->register_function ('FB2JS','GetImgID',\&GetImageID);

my $xpc = XML::LibXML::XPathContext->new();
$xpc->registerNs('fb', $FBURI);

my $parser = XML::LibXML->new();
my $source = $parser->parse_file($XML);

my $style_doc = $parser->parse_file($XSL);
my $BodyStylesheet = $xslt->parse_stylesheet($style_doc);

$style_doc = $parser->parse_file($MetaXSL);
my $MetaStylesheet = $xslt->parse_stylesheet($style_doc);

my $BodyResults = $BodyStylesheet->transform($source);
my $MetaResults = $MetaStylesheet->transform($source);

my $JSonSTR = $BodyStylesheet->output_string($BodyResults);
my $JSonMeta = $MetaStylesheet->output_string($MetaResults);

my @JSonArr = split /[\r\n]+/,$JSonSTR;

my $BlockN = 0;
my $FileN = 0;
my $PageStack = 0;
my $OutFile;
my @BlockMap;
my $RootTOC = {};
my $TOC = $RootTOC;
my @DataToWrite;
my $Start = 0;

for my $Line (@JSonArr) {
	if ($Line =~ s/\{chars:(\d+)\,/{/){
		$PageStack += $1;
		push @DataToWrite,$Line;
		if ($PageStack >= $PartLimit){
			FlushFile();
			$PageStack -= $PartLimit;
			$FileN++;
		}
		$BlockN++;
	} elsif ($Line =~ />>>(.*)/){
		my $NewNode = {s=>$BlockN, parent=>$TOC};
		if ($1){
			$NewNode->{t} = $1;
		}
		push @{$TOC->{c}},$NewNode;
		$TOC = $NewNode;
	} elsif ($Line =~ /<<</){
		$TOC->{e} = $BlockN - 1;
		$TOC = $TOC->{parent};
	}

}

if (@DataToWrite){
	$BlockN--;
	FlushFile();;
}

open $OutFile, ">:utf8","$Out.toc.js";
print $OutFile "{$JSonMeta,\nBody: [";
my $Max = @{$RootTOC->{c}} - 1;
for (my $i=0;$i<=$Max;$i++) {
	print $OutFile DumpTOC($RootTOC->{c}->[$i]);
	if ($i != $Max){
		print $OutFile ",\n";
	}
}
print $OutFile "],Parts:[";
$Max = @BlockMap - 1;
for (my $i=0;$i<=$Max;$i++) {
	my $ShortFN = $BlockMap[$i]->{fn};
	$ShortFN =~ s/.*[\/\\]//;
	$ShortFN =~ s/'/\\'/g;
	print $OutFile "{s:",$BlockMap[$i]->{s},",e:".$BlockMap[$i]->{e}.",xps:".
		$BlockMap[$i]->{xps}.",xpe:".$BlockMap[$i]->{xpe}.",url:'$ShortFN'}";
	if ($i != $Max){
		print $OutFile ",\n";
	}
}
print $OutFile "]}";
close $OutFile;

unlink $TmpXML if $TmpXML;

sub FlushFile{
	return unless @DataToWrite;
	$DataToWrite[0]=~ /\bxp:(\[\d+(,\d+)*\b])/;
	my $XPStart = $1;
	$DataToWrite[$#DataToWrite]=~ /\bxp:(\[\d+(,\d+)*\b])/;
	my $XPEnd = $1;
	push @BlockMap,{s=>$Start,e=>$BlockN,fn=>sprintf("$Out.%03i.js",$FileN),
									xps=>$XPStart,
									xpe=>$XPEnd};
	open OUTFILE, ">:utf8", $BlockMap[$FileN]->{fn};
	$DataToWrite[$#DataToWrite] =~ s/\s*,\s*$//;
	print  OUTFILE '['.join("\n",@DataToWrite).']';
	close  OUTFILE;
	@DataToWrite=();
	$Start = $BlockN + 1;
}


sub DumpTOC{
	my $Node = shift;
	my @Out = ('{s:'.$Node->{s}.',e:'.$Node->{e});
	if ($Node->{t}){
		push @Out,",t:'".$Node->{t}."'";
	}
	if ($Node->{c}){
		push @Out,',c:[';
		for (@{$Node->{c}}){
			push @Out,DumpTOC($_),',';
		}
		pop @Out;
		push @Out,']';
	}
	return join '',@Out,'}';
}

sub CanonizeName {
	my $ImgName = lc(shift);
	$ImgName =~ s/[^\w\.]//g;
	$ImgName =~ s/\.\.+/\./g;
	return $ImgName;
}


sub GetImageID {
	my $ImgID = shift;
	my $id;
	for ($xpc->findnodes("/fb:FictionBook/fb:binary[\@id='$ImgID']",$source)) {
		$id=CanonizeName($_->getAttribute('id'));

		return $DocumentImages{$id}->[0] if $DocumentImages{$id};

		my $ContentType=$_->getAttribute('content-type');

		if (defined($id) && $ContentType=~ /image\/(jpeg|png|gif)/i) {
			my $FN="$Out.$id";
			open IMGFILE, ">$FN" or die "$FN: $!";
			binmode IMGFILE;
			print (IMGFILE decode_base64($_->string_value()));
			close IMGFILE;

			$DocumentImages{$id}=[$id,Image::Size::imgsize($FN)];
		} elsif (defined($id) && $ContentType){
			die "Unknown type '$ContentType' binary found!";
		}
	}
	return $id;
}

sub GetImgW{
	my $Img = CanonizeName(shift);
	return $DocumentImages{$Img}->[1];
}

sub GetImgH{
	my $Img = CanonizeName(shift);
	return $DocumentImages{$Img}->[2];
}
