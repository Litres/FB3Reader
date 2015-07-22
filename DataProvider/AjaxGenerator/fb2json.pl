#!/usr/bin/perl
use strict;
use Hyphenate; # HyphString used, may remove and replace with something

my $TMPPath = '/tmp';

#use XPortal::Settings;  # TMPPath used, you can use your path and remove this
#$TMPPath = $XPortal::Settings::TMPPath;

use strict;
use XML::LibXSLT;
use XML::LibXML;
use utf8;
use Encode;
use Image::Size;
use MIME::Base64;
use JSON::Path;
use JSON::PP;

my $FBURI='http://www.gribuser.ru/xml/fictionbook/2.0';
my $PartLimit = 10000;
my $Styles=qr/a|style|strong|emphasis|sub|sup|strikethrough|code/;
my $LineBreakChars = qr/[\-\/]/;

my $XML = $ARGV[0];
my $XSL = $ARGV[1];
my $MetaXSL = $ARGV[2];
my $Out = $ARGV[3];
my $Version = $ARGV[4];

$Version = 1 if $Version =~/[\D\.]/;

$Version="1.$Version" unless $Version=~/^\d+\.\d+$/;

#my $XML = 'C:/Work/FictionHub/tmp/Vyigotskiyi_vyi_L._Psihologiya_Iskusstva.fb2';
#my $XSL = 'C:/Work/FictionHub/xsl/convert/FB2_2_json.xsl';
#my $MetaXSL = 'C:/Work/FictionHub/xsl/convert/FB2_2_json_meta.xsl';
#my $Out = 'C:\Work\FictionHub\cgi\static\out.html';

unless ($Out){
	print "fb2json converter. Usage:\nfb2json.pl <srcfile.fb2> <stylesheet.xsl> <meta-stylesheet.xsl> </etc/out/> [doc.version]\n";
	exit(0);
}

my %DocumentImages;
my $jsonC = JSON::PP->new->pretty->allow_barekey;

my %HyphCache;
sub SplitString{
	my $Esc=shift || return;
	my $NeedHyph = shift() .' ';
	$NeedHyph *= 1;
	my $SRC = $Esc = EscString($Esc);
	if ($NeedHyph){
		$Esc = $HyphCache{$SRC} || Hyphenate::HyphString($Esc);
	}
	$Esc =~ s/[ \t]+/ ","/g;
	$Esc =~ s/($LineBreakChars+)(?!")/$1","/g;
	$Esc =~ s/("|^) ","/$1 /g;
	$Esc =~ s/"",|,""|","$//g;
	if ($NeedHyph){
		$HyphCache{$SRC} = $Esc;
		$Esc =~ s/\x{AD}/","\x{AD}/g;	# Full version
#		$Esc =~ s/\x{AD}/","/g; 			# Compact version
	}
	return $Esc;
}

sub EscString{
	my $Esc=shift || return;
	$Esc = DecodeUtf8($Esc." "); # Hack to get live string from LibXML
	$Esc =~ s/(["\\])/\\$1/g;
	$Esc =~ s/\r?\n\r?/ /g;
	$Esc =~ s/ $//;
	return $Esc;
}

my $TmpXML;
if (-f $XML) {
	use File::Basename;

	open XML, $XML or die "Cannot open file $XML";
	my $XMLData = DecodeUtf8(join '', (<XML>));
	close XML;

	$XMLData =~ s/([\s>])([^\s<>]+)(<a\s+[^>]*?type="note"[^>]*?>[^<]{1,10}<\/a>[,\.\?"'“”«»‘’;:\)…\/]?)/$1.HypheNOBR($2,$3)/ges;
	$XMLData =~ s/(\S)(<\/$Styles>)(\s+)/$1 $2/gi;

	$TmpXML = $TMPPath . "/". $$ . "_" . basename($XML) . ".xml";

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
	my $Esc = $HyphCache{$Word} || Hyphenate::HyphString($Word);

	unless ($Esc =~ s/\xAD?([^\xAD]+)$/<nobr>$1/s) {
		$Esc = '<nobr>'.$Esc;
	}
	$Esc =~ s/\xAD//gis;

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

#open(BODYOUT, ">:utf8", "$Out.body") or die "Cannot open file $Out.body : $!";
#print BODYOUT $JSonSTR; close BODYOUT;

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

my $jpath   = JSON::Path->new('$..i'); # like XMLPath: //i
my %HrefHash; # (<id> => <json_path>,...)
my $NoCut=0;
for my $Line (@JSonArr) {
	if ($Line =~ s/\{chars:(\d+)\,/{/){
		$PageStack += $1;
		if ($Line =~ s/\{type:"semiblock",/{/){
			$NoCut++;
			if ($Line =~ /,i:"(\w+)"/){
				$HrefHash{ $1 } = $BlockN;
			}
		} else {
			if ($Line =~ s/\{cite\]\}/]}/){
				# Ugly hack, do not know how to do it right now
				$DataToWrite[$#DataToWrite] =~ s/,$//;
				$NoCut--;
			} else {
				my $jsonstr = $Line;
				$jsonstr =~ s/,\s*$//s;
				my $jdata;
				eval { $jdata = $jsonC->decode($jsonstr); };
				if ($@) {
					# хрень кака-то а не json
					die "$jsonstr\n===============\n$@";
				}
				my @vals = $jpath->values($jdata);
				my @paths = $jpath->paths($jdata);
				if (@vals && @paths) {
					for (my $j=0; $j<@vals; $j++){
						if ($vals[$j] && $paths[$j]) {
							my @nodes = ($BlockN);
							while ($paths[$j] =~ /\[([^\]]+)\]/g){
								push @nodes, $1;
							}
							pop @nodes; # ноду i нам не особо нужно, достаточно ее предка
							#die "$jsonstr\n===============\n@vals : @paths : @nodes";
							$HrefHash{ $vals[$j] } = join(',',grep {$_ ne 'c'} @nodes);
						}
					}
				}
			}
		}
		#die "$jsonstr\n===============\n".Data::Dumper::Dumper(\%HrefHash) if keys %HrefHash;

		push @DataToWrite,$Line;
		if ($PageStack >= $PartLimit && !$NoCut){
			FlushFile();
			$PageStack -= $PartLimit;
			$FileN++;
		}
		$BlockN++ unless $NoCut;
	} elsif ($Line =~ />>>( \[([\w-]+)\])?(.*)/){
		my $NewNode = {s=>$BlockN, parent=>$TOC};
		if ($2){
			$HrefHash{ $2 } = $BlockN;
		}
		if ($3){
			$NewNode->{t} = $3;
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

PatchFiles();

$JSonMeta =~ s/",version:"1\.0",Authors:\[/",version:"$Version",Authors:[/;

open $OutFile, ">:utf8",$Out."toc.js";
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
	$ShortFN =~ s/"/\\"/g;
	print $OutFile "{s:",$BlockMap[$i]->{s},",e:".$BlockMap[$i]->{e}.",xps:".
		$BlockMap[$i]->{xps}.",xpe:".$BlockMap[$i]->{xpe}.qq{,url:"$ShortFN"}.'}';
	if ($i != $Max){
		print $OutFile ",\n";
	}
}
print $OutFile "]}";
close $OutFile;

unlink $TmpXML if $TmpXML;

my %NeedPatch;
sub FlushFile{
	return unless @DataToWrite;
	my  $i = 0;
	until ($DataToWrite[$i]=~ /\bxp:(\[\d+(,\d+)*\b])(?!\bxp:\[)/) {
		$i++;
	}
	my $XPStart;
	if ($DataToWrite[$i]=~ /\bxp:(\[\d+(,\d+)*\b])(?!\bxp:\[)/){
		$XPStart = $1;
	} else {
		die "START XPath not found: ".join("\n",@DataToWrite)
	}

	$i = $#DataToWrite;
	until ($DataToWrite[$i]=~ /\bxp:(\[\d+(,\d+)*\b])(?!\bxp:\[)/){
		$i--;
	}
	my $XPEnd;
	if ($DataToWrite[$i]=~ /\bxp:(\[\d+(,\d+)*\b])(?!\bxp:\[)/){
		$XPEnd = $1;
	} else {
		die "END XPath not found: ".join("\n",@DataToWrite)
	}
	push @BlockMap,{s=>$Start,e=>$BlockN,fn=>$Out.sprintf("%03i.js",$FileN),
									xps=>$XPStart,
									xpe=>$XPEnd};
	my $outfile;
	open($outfile, ">:utf8", $BlockMap[$FileN]->{fn}) || die "Cannot open file '$BlockMap[$FileN]->{fn}' : $!";
	$DataToWrite[-1] =~ s/\s*,\s*$//;
	my $datastr = '['.join("\n",@DataToWrite).']';
	while ($datastr =~ /hr:\s*\[\s*"#([^"]+)"\s*\]/sg){
		my $id = $1;
		unless ($id){
			# непонятная ссылка, пропустим
		} elsif (exists($HrefHash{$id})) {
			$datastr =~ s/(hr:\s*\[)\s*"#$id"\s*(\])/$1$HrefHash{$id}$2/gs;
			#warn "[OK] $id => ".$HrefHash{$id};
		} else {
			$NeedPatch{$FileN} ||= {f => $outfile, hr => {}};
			$NeedPatch{$FileN}->{hr}->{$id}++;
		}
	}
	if (exists($NeedPatch{$FileN})){
		$NeedPatch{$FileN}->{d} = $datastr;
		$NeedPatch{$FileN}->{N} = $FileN;
	} else {
		WriteFinalJSONAnd($datastr,$outfile,$FileN);
	}
	@DataToWrite=();
	$Start = $BlockN + 1;
}

sub PatchFiles{
	for my $file (values %NeedPatch){
		for my $id (keys %{ $file->{hr} }){
			if (exists($HrefHash{$id})) {
				$file->{d} =~ s/(hr:\s*\[)\s*"#$id"\s*(\])/$1$HrefHash{$id}$2/gs;
				#warn "[OK] $id => ".$HrefHash{$id};
			} else {
				die "[ERR] broken link '#$id'";
			}
		}
		WriteFinalJSONAnd($file->{d},$file->{f},$file->{N});
	}
}

sub WriteFinalJSONAnd {
	my $JSON = shift;
	my $File = shift;
	my $FileID = shift;

	# Validate final file as a JSON first
	my $jdata;
	eval { $jdata = $JSON };
	if ($@) {
		# хрень кака-то а не json
		die "$FileID broken:\n$@";
	}
	print $File $JSON;

	close $File;
}

sub DumpTOC{
	my $Node = shift;
	my @Out = ('{s:'.$Node->{s}.',e:'.$Node->{e});
	if ($Node->{t}){
		push @Out,',t:"'.$Node->{t}.'"';
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
			my $FN=$Out.$id;
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
sub DecodeUtf8 {
	my $Out = shift;
	unless (Encode::is_utf8($Out)) {
		$Out = Encode::decode_utf8($Out);
	}
	return $Out;
}