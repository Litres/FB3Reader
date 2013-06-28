#!/usr/bin/perl

BEGIN{
  push(@INC, 'C:/Work/FictionHub','/data4/www/WWWHub','/data4/www/WWWHub/bin');
};

use XPortal::Hyphenate;

use strict;
use XML::LibXSLT;
use XML::LibXML;
use utf8;
use Encode;

my $XML = $ARGV[0];
my $XSL = $ARGV[1];
my $Out = $ARGV[2];


#
#my $XML = 'C:/Work/FictionHub/tmp/Vyigotskiyi_vyi_L._Psihologiya_Iskusstva.fb2';
#my $XSL = 'C:/Work/FictionHub/xsl/convert/FB2_2_json.xsl';
#my $Out = 'C:\Work\FictionHub\cgi\static\out.html';

unless ($Out){
	print "fb2json converter. Usage:\nfb2json.pl <stcfile.fb2> <stylesheet.xsl> <out>\n";
	exit(0);
}
my %HyphCache;
sub SplitString{
	my $Esc=shift || return undef;
	my $NeedHyph = shift() .' ';
	$NeedHyph *= 1;
	my $SRC = $Esc = EscString($Esc);
	if ($NeedHyph){
		$Esc = $HyphCache{$SRC} || XPortal::Hyphenate::HyphString($Esc);
	}
	$Esc =~ s/\s+/ ','/g;
	$Esc =~ s/('|^) ','/$1 /g;
	if ($NeedHyph){
		$HyphCache{$SRC} = $Esc;
		$Esc =~ s/\x{AD}/','\x{AD}/g;	# Full version
#		$Esc =~ s/\x{AD}/','/g; 			# Compact version
	}
	return $Esc;
}

sub EscString{
	my $Esc=shift || return undef;
	$Esc = Encode::decode_utf8($Esc." "); # Hack to get live string from LibXML
	$Esc =~ s/(['\\])/\\$1/g;
	$Esc =~ s/\r?\n\r?/ /g;
	$Esc =~ s/ $//;
	return $Esc;
}

my $xslt = XML::LibXSLT->new();
$xslt->register_function ('FB2JS','SplitString',\&SplitString);
$xslt->register_function ('FB2JS','Escape',\&EscString);

my $parser = XML::LibXML->new();
my $source = $parser->parse_file($XML);
my $style_doc = $parser->parse_file($XSL);
my $stylesheet = $xslt->parse_stylesheet($style_doc);
my $results = $stylesheet->transform($source);
my $JSonSTR = $stylesheet->output_string($results);
my @JSonArr = split /[\r\n]+/,$JSonSTR;
my $PartLimit = 10000;
my $BlockN = 0;
my $FileN = 0;
my $PageStack = 0;
my $OutFile;
my @BlockMap;
my $RootTOC = {};
my $TOC = $RootTOC;

for my $Line (@JSonArr){
	unless ($OutFile){
		push @BlockMap,{s=>$BlockN,fn=>sprintf("$Out.%03i.js",$FileN)};
		open $OutFile, ">:utf8", $BlockMap[$FileN]->{fn};
		print $OutFile '[';
	}

	if ($Line =~ s/\{chars:(\d+)\,/{/){
		$PageStack += $1;
		if ($PageStack >= $PartLimit){
			$Line =~ s/,\s*$//;
			print $OutFile $Line;
			$PageStack -= $PartLimit;
			CloseFile($OutFile);
			undef $OutFile;
			$BlockMap[$FileN]->{e} = $BlockN;
			$FileN++;
		} else {
			print $OutFile $Line."\n";
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

if ($OutFile){
	CloseFile($OutFile);
	$BlockMap[$FileN]->{e} = $BlockN-1;
}

open $OutFile, ">:utf8","$Out.toc.js";
print $OutFile "{Body: [";
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
	print $OutFile "{s:",$BlockMap[$i]->{s},",e:".$BlockMap[$i]->{e}.",url:'".
		$BlockMap[$i]->{fn}."'}";
	if ($i != $Max){
		print $OutFile ",\n";
	}
}
print $OutFile "]}";
close $OutFile;

sub CloseFile{
	my $OutFile = shift;
	print $OutFile ']';
	close $OutFile;
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